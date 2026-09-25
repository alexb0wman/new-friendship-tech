import { createPublicClient, http, encodeFunctionData, parseAbi, type Address } from "viem";
import { sepolia } from "viem/chains";
import { normalize, namehash } from "viem/ens";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { config } from "./config";
import { invariant, AppError } from "./errors";
import { syncVerifiedWallets } from "./auth";
import { getDb } from "./db";
import { ensIdentities, users, walletLinks, type UserRow } from "./db/schema";
import { applyWrite } from "./db/write";
import { blockedIds, publicMember } from "./social";
import { requireMember } from "./membership";

export const ensNameSchema = z.string().trim().min(3).max(255).transform((value, ctx) => {
  try { return normalize(value); } catch { ctx.addIssue({ code: "custom", message: "Enter a valid ENS name." }); return z.NEVER; }
});
const resolverABI = parseAbi(["function setText(bytes32 node, string key, string value)"]);
function client() {
  invariant(config().ensEnabled && process.env.ENS_SEPOLIA_RPC_URL, "ENS_UNAVAILABLE", "ENSv2 Sepolia is not configured yet.", 503);
  return createPublicClient({ chain: sepolia, transport: http(process.env.ENS_SEPOLIA_RPC_URL, { timeout: 10000, retryCount: 1 }),
    // On-chain ENSv2 records only in this alpha. Arbitrary CCIP gateways are not fetched server-side.
    ccipRead: false });
}
export async function resolveENS(rawName: string) {
  const name = ensNameSchema.parse(rawName), rpc = client();
  invariant(await rpc.getChainId() === sepolia.id, "ENS_CHAIN", "ENS RPC is on the wrong network.", 503);
  try {
    const address = await rpc.getEnsAddress({ name });
    invariant(address, "ENS_NOT_FOUND", "This name has no address on Sepolia.", 404);
    const resolver = await rpc.getEnsResolver({ name });
    const description = await rpc.getEnsText({ name, key: "description" }).catch(() => null);
    return { name, address: address.toLowerCase(), resolver, description, chainId: sepolia.id, nameHash: namehash(name) };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("ENS_RESOLUTION_FAILED", "Could not resolve this Sepolia name. Off-chain gateway records are not supported in this alpha.", 503, true);
  }
}
export async function linkENS(actor: UserRow, rawName: string) {
  const resolved = await resolveENS(rawName);
  const owned = await syncVerifiedWallets(actor.id, actor.authSubject);
  invariant(owned.includes(resolved.address), "ENS_WALLET_MISMATCH", "The name must resolve to a wallet linked to your account.", 403);
  await applyWrite(actor.id, "ens.link", resolved.nameHash, async (tx) => {
    const [existing] = await tx.select().from(ensIdentities).where(and(eq(ensIdentities.chainId, sepolia.id), eq(ensIdentities.name, resolved.name)));
    invariant(!existing || existing.userId === actor.id, "ENS_CONFLICT", "This name is linked to another account. Contact support to resolve a transfer.", 409);
    await tx.insert(ensIdentities).values({ userId: actor.id, name: resolved.name, chainId: sepolia.id, nameHash: resolved.nameHash,
      address: resolved.address, resolver: resolved.resolver, verifiedAt: new Date(), stale: false })
      .onConflictDoUpdate({ target: [ensIdentities.userId, ensIdentities.chainId], set: {
        name: resolved.name, nameHash: resolved.nameHash, address: resolved.address, resolver: resolved.resolver, verifiedAt: new Date(), stale: false } });
  });
  return resolved;
}
export async function lookupMemberByENS(actorId: string, rawName: string) {
  await requireMember(actorId);
  const resolved = await resolveENS(rawName), db = await getDb();
  const [linked] = await db.select({ user: users }).from(walletLinks).innerJoin(users, eq(walletLinks.userId, users.id))
    .where(and(eq(walletLinks.address, resolved.address), eq(users.visible, true), eq(users.suspended, false))).limit(1);
  invariant(linked && linked.user.id !== actorId && !(await blockedIds(actorId)).has(linked.user.id), "MEMBER_NOT_FOUND", "No discoverable member is linked to that name.", 404);
  // Refresh provider ownership before routing a name-based request to an account.
  const addresses = await syncVerifiedWallets(linked.user.id, linked.user.authSubject);
  invariant(addresses.includes(resolved.address), "MEMBER_NOT_FOUND", "That member's wallet link is no longer current.", 404);
  return { resolved, member: publicMember(linked.user, resolved.name) };
}
export async function prepareDescriptionWrite(actor: UserRow, name: string, description: string, consent: boolean) {
  invariant(config().ensWriteEnabled && consent, "ENS_WRITE_DISABLED", "Confirm publication of this public blockchain record.", 403);
  const resolved = await linkENS(actor, name);
  invariant(resolved.resolver, "NO_RESOLVER", "This name does not have a resolver.", 409);
  const value = z.string().trim().max(160).parse(description), rpc = client();
  // The resolver's actual role permissions decide whether this account can write.
  await rpc.simulateContract({ address: resolved.resolver, abi: resolverABI, functionName: "setText",
    args: [resolved.nameHash, "description", value], account: resolved.address as Address }).catch(() => {
      throw new AppError("ENS_PERMISSION", "Your wallet does not have permission to edit this resolver record.", 403);
    });
  return { chainId: sepolia.id, from: resolved.address, to: resolved.resolver,
    data: encodeFunctionData({ abi: resolverABI, functionName: "setText", args: [resolved.nameHash, "description", value] }) };
}
export async function confirmENSWrite(actor: UserRow, hash: string, name: string) {
  const rpc = client(), receipt = await rpc.getTransactionReceipt({ hash: hash as Address });
  invariant(receipt.status === "success", "ENS_TX_FAILED", "The record update has not succeeded.", 409);
  const tx = await rpc.getTransaction({ hash: hash as Address });
  const owned = await syncVerifiedWallets(actor.id, actor.authSubject);
  invariant(owned.includes(tx.from.toLowerCase()), "ENS_TX_OWNER", "This transaction is not from your linked wallet.", 403);
  return linkENS(actor, name);
}

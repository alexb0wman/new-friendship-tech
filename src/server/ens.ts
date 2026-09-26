import {
  createPublicClient,
  http,
  encodeFunctionData,
  parseAbi,
  type Address,
  type Hash,
} from "viem";
import { sepolia } from "viem/chains";
import { normalize, namehash } from "viem/ens";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { config } from "./config";
import { invariant, AppError } from "./errors";
import { syncVerifiedWallets } from "./auth";
import { getDb } from "./db";
import { ensIdentities, ensWriteIntents, users, walletLinks, type UserRow } from "./db/schema";
import { applyWrite } from "./db/write";
import { blockedIds, publicMember } from "./social";
import { requireMember } from "./membership";
import { assertENSWriteProof } from "./ens-proof";
import { ensNetwork, ensRpcUrl } from "./ens-network";
import { resolverAbi as v2ResolverABI } from "./ens-v2/abi";
import { dnsName } from "./ens-v2/names";

export const ensNameSchema = z
  .string()
  .trim()
  .min(3)
  .max(255)
  .transform((value, ctx) => {
    try {
      return normalize(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Enter a valid ENS name." });
      return z.NEVER;
    }
  });
const resolverABI = parseAbi(["function setText(bytes32 node, string key, string value)"]);
function client(chainId: number = ensNetwork().id) {
  const network = ensNetwork(chainId),
    rpcUrl = ensRpcUrl(chainId);
  invariant(
    config().ensEnabled && rpcUrl,
    "ENS_UNAVAILABLE",
    "ENS is not configured on " + network.name + ".",
    503,
  );
  return createPublicClient({
    chain: network,
    transport: http(rpcUrl, { timeout: 10000, retryCount: 1 }),
    // On-chain ENSv2 records only in this alpha. Arbitrary CCIP gateways are not fetched server-side.
    ccipRead: false,
  });
}
export async function resolveENS(rawName: string, chainId: number = ensNetwork().id) {
  const name = ensNameSchema.parse(rawName),
    rpc = client(chainId);
  invariant(
    (await rpc.getChainId()) === chainId,
    "ENS_CHAIN",
    "ENS RPC is on the wrong network.",
    503,
  );
  try {
    const address = await rpc.getEnsAddress({ name });
    invariant(
      address,
      "ENS_NOT_FOUND",
      "This name has no address on " + ensNetwork(chainId).name + ".",
      404,
    );
    const resolver = await rpc.getEnsResolver({ name });
    const description = await rpc.getEnsText({ name, key: "description" }).catch(() => null);
    return {
      name,
      address: address.toLowerCase(),
      resolver,
      description,
      chainId,
      nameHash: namehash(name),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "ENS_RESOLUTION_FAILED",
      "Could not resolve this ENS name. Off-chain gateway records are not supported.",
      503,
      true,
    );
  }
}
export async function linkENS(actor: UserRow, rawName: string, chainId: number = ensNetwork().id) {
  const resolved = await resolveENS(rawName, chainId);
  const owned = await syncVerifiedWallets(actor.id, actor.authSubject);
  invariant(
    owned.includes(resolved.address),
    "ENS_WALLET_MISMATCH",
    "The name must resolve to a wallet linked to your account.",
    403,
  );
  await applyWrite(actor.id, "ens.link", resolved.nameHash, async (tx) => {
    const [existing] = await tx
      .select()
      .from(ensIdentities)
      .where(
        and(eq(ensIdentities.chainId, resolved.chainId), eq(ensIdentities.name, resolved.name)),
      );
    invariant(
      !existing || existing.userId === actor.id,
      "ENS_CONFLICT",
      "This name is linked to another account. Contact support to resolve a transfer.",
      409,
    );
    await tx
      .insert(ensIdentities)
      .values({
        userId: actor.id,
        name: resolved.name,
        chainId: resolved.chainId,
        nameHash: resolved.nameHash,
        address: resolved.address,
        resolver: resolved.resolver,
        verifiedAt: new Date(),
        stale: false,
      })
      .onConflictDoUpdate({
        target: [ensIdentities.userId, ensIdentities.chainId],
        set: {
          name: resolved.name,
          nameHash: resolved.nameHash,
          address: resolved.address,
          resolver: resolved.resolver,
          verifiedAt: new Date(),
          stale: false,
        },
      });
  });
  return resolved;
}
export async function lookupMemberByENS(actorId: string, rawName: string) {
  await requireMember(actorId);
  const resolved = await resolveENS(rawName),
    db = await getDb();
  const [linked] = await db
    .select({ user: users })
    .from(walletLinks)
    .innerJoin(users, eq(walletLinks.userId, users.id))
    .where(
      and(
        eq(walletLinks.address, resolved.address),
        eq(users.visible, true),
        eq(users.suspended, false),
      ),
    )
    .limit(1);
  invariant(
    linked && linked.user.id !== actorId && !(await blockedIds(actorId)).has(linked.user.id),
    "MEMBER_NOT_FOUND",
    "No discoverable member is linked to that name.",
    404,
  );
  // Refresh provider ownership before routing a name-based request to an account.
  const addresses = await syncVerifiedWallets(linked.user.id, linked.user.authSubject);
  invariant(
    addresses.includes(resolved.address),
    "MEMBER_NOT_FOUND",
    "That member's wallet link is no longer current.",
    404,
  );
  return { resolved, member: publicMember(linked.user, resolved.name) };
}
export async function prepareDescriptionWrite(
  actor: UserRow,
  name: string,
  description: string,
  consent: boolean,
) {
  invariant(
    config().ensWriteEnabled && consent,
    "ENS_WRITE_DISABLED",
    "Confirm publication of this public blockchain record.",
    403,
  );
  const resolved = await linkENS(actor, name);
  invariant(resolved.resolver, "NO_RESOLVER", "This name does not have a resolver.", 409);
  const value = z.string().trim().max(160).parse(description),
    rpc = client(resolved.chainId);
  // The deployed PermissionedResolver takes a DNS name; Ethereum's PublicResolver takes a node.
  // Restrict the v2 ABI to our known Sepolia instance, rather than guessing a contract interface.
  const appResolver = process.env.ENS_APP_RESOLVER?.toLowerCase();
  const data =
    resolved.chainId === sepolia.id && resolved.resolver.toLowerCase() === appResolver
      ? encodeFunctionData({
          abi: v2ResolverABI,
          functionName: "setText",
          args: [dnsName(resolved.name), "description", value],
        })
      : encodeFunctionData({
          abi: resolverABI,
          functionName: "setText",
          args: [resolved.nameHash, "description", value],
        });
  // The resolver's actual role permissions decide whether this account can write.
  await rpc
    .call({
      to: resolved.resolver,
      data,
      account: resolved.address as Address,
    })
    .catch(() => {
      throw new AppError(
        "ENS_PERMISSION",
        "Your wallet does not have permission to edit this resolver record.",
        403,
      );
    });
  const intent = await applyWrite(
    actor.id,
    "ens.write.prepare",
    resolved.nameHash,
    async (tx) =>
      (
        await tx
          .insert(ensWriteIntents)
          .values({
            userId: actor.id,
            name: resolved.name,
            wallet: resolved.address,
            resolver: resolved.resolver!,
            chainId: resolved.chainId,
            calldata: data,
            description: value,
            expiresAt: new Date(Date.now() + 20 * 60000),
          })
          .returning()
      )[0],
  );
  return {
    intentId: intent.id,
    chainId: resolved.chainId,
    from: resolved.address,
    to: resolved.resolver,
    data,
  };
}
export async function confirmENSWrite(actor: UserRow, hash: string, intentId: string) {
  const db = await getDb();
  const [intent] = await db
    .select()
    .from(ensWriteIntents)
    .where(and(eq(ensWriteIntents.id, intentId), eq(ensWriteIntents.userId, actor.id)));
  invariant(intent, "NOT_FOUND", "Record update not found.", 404);
  invariant(
    !intent.txHash || intent.txHash === hash,
    "ENS_TX_MISMATCH",
    "This update is already bound to another transaction.",
    409,
  );
  invariant(
    intent.confirmedAt || intent.expiresAt > new Date(),
    "ENS_INTENT_EXPIRED",
    "This record-update intent expired. Read your current record and prepare a fresh update if needed.",
    409,
  );
  const rpc = client(intent.chainId);
  const [receipt, transaction, chainId] = await Promise.all([
    rpc.getTransactionReceipt({ hash: hash as Hash }),
    rpc.getTransaction({ hash: hash as Hash }),
    rpc.getChainId(),
  ]);
  const resolved = await resolveENS(intent.name, intent.chainId);
  assertENSWriteProof(intent, transaction, receipt, resolved.description, chainId);
  invariant(
    resolved.resolver?.toLowerCase() === intent.resolver.toLowerCase(),
    "ENS_RESOLVER_CHANGED",
    "The resolver changed. Prepare a new update against the current resolver.",
    409,
  );
  const linked = await linkENS(actor, intent.name, intent.chainId);
  await applyWrite(actor.id, "ens.write.confirm", intent.id, async (tx) => {
    const [current] = await tx
      .select()
      .from(ensWriteIntents)
      .where(eq(ensWriteIntents.id, intent.id))
      .for("update");
    invariant(
      !current.txHash || current.txHash === hash,
      "ENS_TX_MISMATCH",
      "This update is already confirmed with another transaction.",
      409,
    );
    await tx
      .update(ensWriteIntents)
      .set({ txHash: hash, confirmedAt: new Date() })
      .where(eq(ensWriteIntents.id, intent.id));
  });
  return linked;
}

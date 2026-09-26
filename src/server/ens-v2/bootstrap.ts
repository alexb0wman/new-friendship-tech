import {
  concat,
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  getCreate2Address,
  http,
  keccak256,
  parseEventLogs,
  stringToHex,
  toHex,
  zeroAddress,
  BaseError,
  ContractFunctionRevertedError,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { namehash, normalize } from "viem/ens";
import { ethRegistrarAbi, factoryAbi, mockUsdcAbi, registryAbi, resolverAbi } from "./abi";
import { SEPOLIA } from "./addresses";
import { encodeTextSetter } from "./encode";
import { CONCIERGE_TEXT_KEYS, ALL_ROLES, OWNER_BITMAP, REGISTRY, RESOLVER } from "./roles";
import { FAR_FUTURE_EXPIRY, conciergeContext, dnsName, labelId } from "./names";

/**
 * One-off provisioning of the ENSv2 namespace on Sepolia, run by the operator wallet.
 *
 *   <parent>.eth                ETHRegistry token (registered here with --register-parent, or by hand)
 *   ├── (subregistry)           parent UserRegistry proxy, mounted with ETHRegistry.setSubregistry
 *   │   ├── tokyo               entry: subregistry = city registry, resolver = none (see design 2.2)
 *   │   │   └── (subregistry)   city UserRegistry proxy: trips are registered here
 *   │   │       ├── tables      entry: resolver = app resolver, far-future expiry
 *   │   │       └── concierge   entry: resolver = app resolver, linked to concierge.<parent>'s record
 *   │   └── concierge           entry: resolver = app resolver, ENSIP-26 records
 *   └── app resolver            PermissionedResolver proxy; concierge holds setter roles for two keys
 *
 * Every step is idempotent where the chain allows: proxies are skipped when their CREATE2 address
 * already has code, registrations are skipped when the label is registered, role grants are
 * no-ops when already held. The output JSON is the judge evidence and the source of the env block.
 */
export interface BootstrapOptions {
  rpcUrl: string;
  operatorKey: Hex;
  conciergeAddress: Address;
  parentName: string;
  origin: string;
  registerParent: boolean;
  version: bigint;
  log: (line: string) => void;
}
export interface BootstrapOutput {
  at: string;
  chainId: number;
  parentName: string;
  operator: Address;
  concierge: Address;
  appResolver: Address;
  parentRegistry: Address;
  cityRegistryTokyo: Address;
  txs: Record<string, string>;
  conciergeScoped: boolean;
  env: Record<string, string>;
}
const ROLE_SET_TEXT_PROBE = "description";
export async function predictProxyAddress(input: {
  factory: Address;
  proxyLogic: Address;
  deployer: Address;
  salt: bigint;
}) {
  const outerSalt = keccak256(
    encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [input.deployer, input.salt]),
  );
  const initCode = concat([
    "0x3d604d80600a3d3981f3363d3d373d3d3d363d73",
    input.proxyLogic,
    "0x5af43d82803e903d91602b57fd5bf3",
    outerSalt,
  ]);
  return getCreate2Address({
    from: input.factory,
    salt: outerSalt,
    bytecodeHash: keccak256(initCode),
  });
}
export const resolverSalt = (owner: Address, version: bigint) =>
  BigInt(
    keccak256(
      encodeAbiParameters(
        [{ type: "bytes32" }, { type: "address" }, { type: "uint256" }],
        [keccak256(stringToHex("OwnedResolver")), owner, version],
      ),
    ),
  );
export const registrySalt = (name: string, version: bigint) =>
  BigInt(
    keccak256(
      encodeAbiParameters(
        [{ type: "bytes32" }, { type: "bytes32" }, { type: "uint256" }],
        [keccak256(stringToHex("UserRegistry")), namehash(name), version],
      ),
    ),
  );
export async function bootstrap(options: BootstrapOptions): Promise<BootstrapOutput> {
  const parent = normalize(options.parentName);
  if (!parent.endsWith(".eth") || parent.split(".").length !== 2)
    throw new Error("ENS_PARENT_NAME must be a second-level .eth name");
  const parentLabel = parent.slice(0, -4);
  const account = privateKeyToAccount(options.operatorKey);
  if (account.address.toLowerCase() === options.conciergeAddress.toLowerCase())
    throw new Error("The operator and concierge must use different wallets.");
  if (options.conciergeAddress.toLowerCase() === zeroAddress)
    throw new Error("The concierge wallet cannot be the zero address.");
  const origin = new URL(options.origin);
  if (origin.protocol !== "https:" || origin.origin !== options.origin)
    throw new Error("APP_ORIGIN must be a public HTTPS origin without a path or trailing slash.");
  const transport = http(options.rpcUrl, { timeout: 30000 });
  const client = createPublicClient({ chain: sepolia, transport });
  const wallet = createWalletClient({ account, chain: sepolia, transport });
  const chainId = await client.getChainId();
  if (chainId !== sepolia.id) throw new Error("RPC is not Sepolia (chain " + chainId + ")");
  for (const address of [
    SEPOLIA.verifiableFactory,
    SEPOLIA.ethRegistry,
    SEPOLIA.ethRegistrar,
    SEPOLIA.permissionedResolverImpl,
    SEPOLIA.userRegistryImpl,
  ]) {
    const code = await client.getCode({ address });
    if (!code || code === "0x")
      throw new Error(
        "ENSv2 contract missing at " + address + ". Recheck the official Sepolia deployment.",
      );
  }
  const txs: Record<string, string> = {};
  const log = options.log;
  async function send(label: string, to: Address, data: Hex) {
    await client.call({ account, to, data });
    const hash = await wallet.sendTransaction({ account, chain: sepolia, to, data });
    const receipt = await client.waitForTransactionReceipt({
      hash,
      confirmations: 2,
      timeout: 180000,
    });
    if (receipt.status !== "success") throw new Error(label + " reverted: " + hash);
    txs[label] = hash;
    log(label + " " + hash);
    return receipt;
  }
  const factory = SEPOLIA.verifiableFactory as Address;
  const proxyLogic = await client.readContract({
    address: factory,
    abi: factoryAbi,
    functionName: "proxyLogic",
  });
  async function ensureProxy(label: string, implementation: Address, salt: bigint, initData: Hex) {
    const predicted = await predictProxyAddress({
      factory,
      proxyLogic,
      deployer: account.address,
      salt,
    });
    const code = await client.getCode({ address: predicted });
    if (code && code !== "0x") {
      log(label + " already deployed at " + predicted);
      return predicted;
    }
    const receipt = await send(
      "deploy." + label,
      factory,
      encodeFunctionData({
        abi: factoryAbi,
        functionName: "deployProxy",
        args: [implementation, salt, initData],
      }),
    );
    const [event] = parseEventLogs({
      abi: factoryAbi,
      eventName: "ProxyDeployed",
      logs: receipt.logs,
    });
    const deployed = event?.args.proxyAddress as Address | undefined;
    if (!deployed) throw new Error(label + ": no ProxyDeployed event");
    if (deployed.toLowerCase() !== predicted.toLowerCase())
      throw new Error(label + ": deployed " + deployed + " but predicted " + predicted);
    return deployed;
  }
  // 0. The parent name itself (commit-reveal on the ETH Registrar, paid in MockUSDC).
  const registrar = SEPOLIA.ethRegistrar as Address,
    usdc = SEPOLIA.mockUsdc as Address;
  const available = await client.readContract({
    address: registrar,
    abi: ethRegistrarAbi,
    functionName: "isAvailable",
    args: [parentLabel],
  });
  if (available) {
    if (!options.registerParent)
      throw new Error(
        parent +
          " is not registered. Register it in the ENS app for Sepolia or rerun with --register-parent.",
      );
    const duration = 365n * 86400n;
    const [base, premium] = await client.readContract({
      address: registrar,
      abi: ethRegistrarAbi,
      functionName: "getRegisterPrice",
      args: [parentLabel, duration, usdc],
    });
    const price = base + premium;
    await send(
      "usdc.mint",
      usdc,
      encodeFunctionData({
        abi: mockUsdcAbi,
        functionName: "mint",
        args: [account.address, price * 2n],
      }),
    );
    await send(
      "usdc.approve",
      usdc,
      encodeFunctionData({ abi: mockUsdcAbi, functionName: "approve", args: [registrar, price] }),
    );
    const secret = keccak256(toHex(crypto.randomUUID()));
    const commitment = await client.readContract({
      address: registrar,
      abi: ethRegistrarAbi,
      functionName: "makeCommitment",
      args: [
        parentLabel,
        account.address,
        secret,
        zeroAddress,
        zeroAddress,
        duration,
        ("0x" + "0".repeat(64)) as Hex,
      ],
    });
    await send(
      "parent.commit",
      registrar,
      encodeFunctionData({ abi: ethRegistrarAbi, functionName: "commit", args: [commitment] }),
    );
    const minAge = await client.readContract({
      address: registrar,
      abi: ethRegistrarAbi,
      functionName: "MIN_COMMITMENT_AGE",
    });
    const waitMs = Number(minAge) * 1000 + 15000;
    log("waiting " + Math.round(waitMs / 1000) + "s for the commitment to age");
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    await send(
      "parent.register",
      registrar,
      encodeFunctionData({
        abi: ethRegistrarAbi,
        functionName: "register",
        args: [
          parentLabel,
          account.address,
          secret,
          zeroAddress,
          zeroAddress,
          duration,
          usdc,
          ("0x" + "0".repeat(64)) as Hex,
        ],
      }),
    );
  } else log(parent + " is registered");
  const canMount = await client.readContract({
    address: SEPOLIA.ethRegistry,
    abi: registryAbi,
    functionName: "hasRoles",
    args: [labelId(parentLabel), REGISTRY.ROLE_SET_SUBREGISTRY, account.address],
  });
  if (!canMount) throw new Error("The operator does not hold the parent name's subregistry role.");
  // 1. App resolver: operator holds every role; the concierge gets two keys later.
  const appResolver = await ensureProxy(
    "appResolver",
    SEPOLIA.permissionedResolverImpl as Address,
    resolverSalt(account.address, options.version),
    encodeFunctionData({
      abi: resolverAbi,
      functionName: "initialize",
      args: [[{ account: account.address, roleBitmap: ALL_ROLES }], []],
    }),
  );
  // 2. Parent registry, mounted under <parent>.eth.
  const parentRegistry = await ensureProxy(
    "parentRegistry",
    SEPOLIA.userRegistryImpl as Address,
    registrySalt(parent, options.version),
    encodeFunctionData({
      abi: registryAbi,
      functionName: "initialize",
      args: [[{ account: account.address, roleBitmap: ALL_ROLES }]],
    }),
  );
  const ethRegistry = SEPOLIA.ethRegistry as Address;
  const mounted = await client.readContract({
    address: ethRegistry,
    abi: registryAbi,
    functionName: "getSubregistry",
    args: [parentLabel],
  });
  if (mounted.toLowerCase() !== parentRegistry.toLowerCase())
    await send(
      "parent.setSubregistry",
      ethRegistry,
      encodeFunctionData({
        abi: registryAbi,
        functionName: "setSubregistry",
        args: [labelId(parentLabel), parentRegistry],
      }),
    );
  else log("parent registry already mounted");
  // 3. City registry for Tokyo, mounted at tokyo.<parent> with no resolver (expired trips must stop resolving).
  const cityRegistry = await ensureProxy(
    "cityRegistryTokyo",
    SEPOLIA.userRegistryImpl as Address,
    registrySalt("tokyo." + parent, options.version),
    encodeFunctionData({
      abi: registryAbi,
      functionName: "initialize",
      args: [[{ account: account.address, roleBitmap: ALL_ROLES }]],
    }),
  );
  async function ensureEntry(
    registry: Address,
    label: string,
    subregistry: Address,
    resolver: Address,
  ) {
    const status = await client.readContract({
      address: registry,
      abi: registryAbi,
      functionName: "getStatus",
      args: [labelId(label)],
    });
    if (Number(status) === 2) {
      log(label + " already registered in " + registry);
      const current = await client.readContract({
        address: registry,
        abi: registryAbi,
        functionName: "getSubregistry",
        args: [label],
      });
      if (current.toLowerCase() !== subregistry.toLowerCase())
        await send(
          label + ".setSubregistry",
          registry,
          encodeFunctionData({
            abi: registryAbi,
            functionName: "setSubregistry",
            args: [labelId(label), subregistry],
          }),
        );
      const currentResolver = await client.readContract({
        address: registry,
        abi: registryAbi,
        functionName: "getResolver",
        args: [label],
      });
      if (currentResolver.toLowerCase() !== resolver.toLowerCase())
        await send(
          label + ".setResolver",
          registry,
          encodeFunctionData({
            abi: registryAbi,
            functionName: "setResolver",
            args: [labelId(label), resolver],
          }),
        );
      return;
    }
    await send(
      "register." + label,
      registry,
      encodeFunctionData({
        abi: registryAbi,
        functionName: "register",
        args: [
          label,
          account.address,
          subregistry,
          resolver,
          OWNER_BITMAP,
          BigInt(FAR_FUTURE_EXPIRY),
        ],
      }),
    );
  }
  await ensureEntry(parentRegistry, "tokyo", cityRegistry, zeroAddress);
  await ensureEntry(parentRegistry, "concierge", zeroAddress, appResolver);
  await ensureEntry(cityRegistry, "tables", zeroAddress, appResolver);
  await ensureEntry(cityRegistry, "concierge", zeroAddress, appResolver);
  // 4. The concierge's two keys, and nothing else.
  for (const key of CONCIERGE_TEXT_KEYS)
    await send(
      "grant." + key,
      appResolver,
      encodeFunctionData({
        abi: resolverAbi,
        functionName: "grantSetterRoles",
        args: [encodeTextSetter(key), options.conciergeAddress],
      }),
    );
  // 5. ENSIP-26 records on concierge.<parent>, then alias concierge.tokyo.<parent> to the same record.
  const conciergeRoot = "concierge." + parent;
  await send(
    "concierge.records",
    appResolver,
    encodeFunctionData({
      abi: resolverAbi,
      functionName: "multicall",
      args: [
        [
          encodeFunctionData({
            abi: resolverAbi,
            functionName: "setAddress",
            args: [dnsName(conciergeRoot), 60n, options.conciergeAddress],
          }),
          encodeFunctionData({
            abi: resolverAbi,
            functionName: "setText",
            args: [dnsName(conciergeRoot), "agent-context", conciergeContext(options.origin)],
          }),
          encodeFunctionData({
            abi: resolverAbi,
            functionName: "setText",
            args: [dnsName(conciergeRoot), "agent-endpoint[mcp]", options.origin + "/api/mcp"],
          }),
          encodeFunctionData({
            abi: resolverAbi,
            functionName: "setText",
            args: [dnsName(conciergeRoot), "agent-endpoint[web]", options.origin + "/concierge"],
          }),
          encodeFunctionData({
            abi: resolverAbi,
            functionName: "setText",
            args: [
              dnsName(conciergeRoot),
              "description",
              "New Friendship Tech concierge: one agent, two keys, every action approved.",
            ],
          }),
        ],
      ],
    }),
  );
  await send(
    "concierge.alias",
    appResolver,
    encodeFunctionData({
      abi: resolverAbi,
      functionName: "linkToNode",
      args: [dnsName("concierge.tokyo." + parent), namehash(conciergeRoot)],
    }),
  );
  // 6. Prove the scope: the concierge can write friendship.now and cannot write description.
  let conciergeScoped = false;
  try {
    await client.simulateContract({
      address: appResolver,
      abi: resolverAbi,
      functionName: "setText",
      args: [dnsName(conciergeRoot), ROLE_SET_TEXT_PROBE, "x"],
      account: options.conciergeAddress,
    });
    log(
      "WARNING: the concierge could write description; the setter grant is not scoped as expected",
    );
  } catch (error) {
    const revert =
      error instanceof BaseError
        ? error.walk((cause) => cause instanceof ContractFunctionRevertedError)
        : undefined;
    if (
      !(revert instanceof ContractFunctionRevertedError) ||
      revert.data?.errorName !== "EACUnauthorizedAccountRoles"
    )
      throw error;
    conciergeScoped = true;
    log("concierge write to description is denied by the permission contract");
  }
  if (!conciergeScoped) throw new Error("The concierge has excessive description permissions.");
  // A failed RPC call is never evidence of restricted permissions. Check every root role too.
  for (const role of Object.values(RESOLVER)) {
    for (const bit of [role, role << 128n]) {
      const held = await client.readContract({
        address: appResolver,
        abi: resolverAbi,
        functionName: "hasRootRoles",
        args: [bit, options.conciergeAddress],
      });
      if (held) throw new Error("The concierge has unexpected root resolver permissions.");
    }
  }
  for (const key of CONCIERGE_TEXT_KEYS) {
    await client.simulateContract({
      address: appResolver,
      abi: resolverAbi,
      functionName: "setText",
      args: [dnsName(conciergeRoot), key, "{}"],
      account: options.conciergeAddress,
    });
    log("concierge write to " + key + " simulates fine");
  }
  const [resolvedAddress, context, endpoint, alias] = await Promise.all([
    client.getEnsAddress({ name: conciergeRoot }),
    client.getEnsText({ name: conciergeRoot, key: "agent-context" }),
    client.getEnsText({ name: conciergeRoot, key: "agent-endpoint[mcp]" }),
    client.getEnsAddress({ name: "concierge.tokyo." + parent }),
  ]);
  if (
    resolvedAddress?.toLowerCase() !== options.conciergeAddress.toLowerCase() ||
    alias?.toLowerCase() !== options.conciergeAddress.toLowerCase() ||
    context !== conciergeContext(options.origin) ||
    endpoint !== options.origin + "/api/mcp"
  )
    throw new Error("The deployed concierge records did not match independent ENS reads.");
  log("concierge records and city alias verified through the Universal Resolver");
  return {
    at: new Date().toISOString(),
    chainId,
    parentName: parent,
    operator: account.address,
    concierge: options.conciergeAddress,
    appResolver,
    parentRegistry,
    cityRegistryTokyo: cityRegistry,
    txs,
    conciergeScoped,
    env: {
      ENS_ENABLED: "true",
      ENS_WRITE_ENABLED: "true",
      ENS_PARENT_NAME: parent,
      ENS_PARENT_REGISTRY: parentRegistry,
      ENS_CITY_REGISTRY_TOKYO: cityRegistry,
      ENS_APP_RESOLVER: appResolver,
    },
  };
}

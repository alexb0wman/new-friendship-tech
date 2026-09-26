import { encodeFunctionData, type Hex } from "viem";
import { resolverAbi, registryAbi } from "./abi";
import { dnsName, labelId } from "./names";
import type { RecordWrite } from "./types";

/** One resolver setter call per record, on the DNS-encoded name (Permissioned Resolver setters take bytes name). */
export function encodeRecordCalls(name: string, records: RecordWrite[]): Hex[] {
  const wire = dnsName(name);
  return records.map((record) =>
    record.type === "text"
      ? encodeFunctionData({
          abi: resolverAbi,
          functionName: "setText",
          args: [wire, record.key, record.value],
        })
      : encodeFunctionData({
          abi: resolverAbi,
          functionName: "setAddress",
          args: [
            wire,
            BigInt(record.coinType),
            record.address === "" ? "0x" : (record.address as Hex),
          ],
        }),
  );
}
export function encodeMulticall(calls: Hex[]): Hex {
  return encodeFunctionData({ abi: resolverAbi, functionName: "multicall", args: [calls] });
}
export function encodeRegister(input: {
  label: string;
  owner: string;
  registry: string;
  resolver: string;
  roleBitmap: bigint;
  expiry: number;
}): Hex {
  return encodeFunctionData({
    abi: registryAbi,
    functionName: "register",
    args: [
      input.label,
      input.owner as Hex,
      input.registry as Hex,
      input.resolver as Hex,
      input.roleBitmap,
      BigInt(input.expiry),
    ],
  });
}
export function encodeRenew(label: string, expiry: number): Hex {
  return encodeFunctionData({
    abi: registryAbi,
    functionName: "renew",
    args: [labelId(label), BigInt(expiry)],
  });
}
export function encodeUnregister(label: string): Hex {
  return encodeFunctionData({
    abi: registryAbi,
    functionName: "unregister",
    args: [labelId(label)],
  });
}
/** The setter calldata grantSetterRoles derives a key-scoped role from; only selector and key matter. */
export function encodeTextSetter(key: string): Hex {
  return encodeFunctionData({ abi: resolverAbi, functionName: "setText", args: ["0x", key, ""] });
}

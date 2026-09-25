import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

const allowed = new Set([
  "DATABASE_URL",
  "PRIVY_APP_SECRET",
  "ENS_SEPOLIA_RPC_URL",
  "PAYMENT_RPC_URL",
]);
let pending: Promise<void> | undefined;
/** Child-process runtime loading keeps secrets out of PM2's saved parent environment. */
export function loadRuntimeSecrets(): Promise<void> {
  return (pending ??= load());
}
async function load() {
  if (process.env.APP_MODE === "demo" || !process.env.SECRET_ENV_MAP) return;
  const map: unknown = JSON.parse(process.env.SECRET_ENV_MAP);
  if (!map || typeof map !== "object" || Array.isArray(map))
    throw new Error("Invalid SECRET_ENV_MAP");
  const entries = Object.entries(map);
  for (const [key, name] of entries) {
    if (
      !allowed.has(key) ||
      typeof name !== "string" ||
      !/^projects\/[a-zA-Z0-9_-]+\/secrets\/[a-zA-Z0-9_-]+\/versions\/(?:latest|[0-9]+)$/.test(name)
    ) {
      throw new Error("Invalid or unsupported runtime secret reference");
    }
  }
  const client = new SecretManagerServiceClient();
  try {
    const resolved = await Promise.all(
      entries.map(async ([key, name]) => {
        const [response] = await client.accessSecretVersion({ name: String(name) });
        const data = response.payload?.data;
        const value =
          typeof data === "string"
            ? Buffer.from(data, "base64").toString("utf8")
            : Buffer.from(data ?? []).toString("utf8");
        if (!value || value.includes("\0")) throw new Error("Empty or invalid runtime secret");
        return [key, value] as const;
      }),
    );
    // Commit all-or-nothing. Never print payloads or provider exception objects.
    for (const [key, value] of resolved) process.env[key] = value;
  } catch {
    throw new Error(
      "Unable to load runtime secrets. Check service-account access and configured references.",
    );
  } finally {
    await client.close();
  }
}

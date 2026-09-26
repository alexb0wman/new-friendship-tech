// Tests seed their own trips; skip the demo fixtures so simulated chain state starts empty.
process.env.NFT_SKIP_ENS_SEED = "true";
import { handleApi } from "@/server/router";
import { demoSession } from "@/server/auth";

export const cookies: Record<string, string> = {};
export const ACTORS = ["alex", "maya", "admin", "kenji", "ari"] as const;
export async function bootSessions() {
  for (const actor of ACTORS) cookies[actor] = "nftech_demo=" + (await demoSession(actor));
}
export async function api(
  path: string,
  actor?: string,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const request = new Request("http://localhost:3000/api/" + path, {
    method,
    headers: {
      Origin: "http://localhost:3000",
      "Content-Type": "application/json",
      ...(actor ? { Cookie: cookies[actor] } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const response = await handleApi(request);
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: response.status, body: parsed as any, headers: response.headers };
}

import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
const port = 3092,
  origin = "http://127.0.0.1:" + port;
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--webpack",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    env: {
      ...process.env,
      NODE_ENV: "development",
      APP_MODE: "demo",
      NEXT_PUBLIC_APP_MODE: "demo",
      APP_ORIGIN: origin,
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  },
);
let tail = "";
for (const stream of [server.stdout, server.stderr])
  stream.on("data", (data) => {
    tail = (tail + data.toString()).slice(-12000);
  });
let passed = false;
try {
  let healthy = false;
  for (let attempt = 0; attempt < 45; attempt++) {
    if (server.exitCode !== null) throw new Error("Server exited before health check");
    try {
      const r = await fetch(origin + "/api/health", { signal: AbortSignal.timeout(15000) });
      healthy = r.ok;
      if (healthy) break;
    } catch {}
    await delay(1000);
  }
  assert(healthy, "health endpoint");
  console.log("HTTP smoke: database and health ready.");
  const root = await fetch(origin);
  assert.equal(root.status, 200);
  assert((await root.text()).includes("New Friendship Tech"));
  console.log("HTTP smoke: homepage rendered.");
  const app = await fetch(origin + "/tokyo");
  assert.equal(app.status, 200);
  const preview = await (await fetch(origin + "/api/places")).json();
  assert.equal(preview.items.length, 6);
  const session = await fetch(origin + "/api/demo/session", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ actor: "maya" }),
  });
  assert.equal(session.status, 200, session.ok ? "session created" : await session.text());
  const cookie = session.headers.get("set-cookie").split(";")[0];
  const places = await (
    await fetch(origin + "/api/places", { headers: { Cookie: cookie } })
  ).json();
  assert.equal(places.items.length, 24);
  const denied = await fetch(origin + "/api/me/visibility", {
    method: "PATCH",
    headers: { Cookie: cookie, Origin: "https://bad.example", "Content-Type": "application/json" },
    body: JSON.stringify({ visible: false }),
  });
  assert.equal(denied.status, 403);
  const css = await fetch(origin + "/art/tokyo.svg");
  assert.equal(css.status, 200);
  passed = true;
  console.log(
    "HTTP smoke passed: server boot, migrations, homepage, app route, preview, signed session, full catalog, origin enforcement, artwork.",
  );
} finally {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
  if (!passed) console.error(tail);
}

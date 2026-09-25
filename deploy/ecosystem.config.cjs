// Paths and public values only. Load secrets inside each child through SECRET_ENV_MAP.
const cwd = process.env.NFTECH_RELEASE_DIR;
if (!cwd || !cwd.startsWith("/")) throw new Error("Set an absolute NFTECH_RELEASE_DIR.");
const env = {
  NODE_ENV: "production",
  APP_MODE: "production",
  NEXT_PUBLIC_APP_MODE: "production",
  APP_ORIGIN: process.env.APP_ORIGIN,
  PRIVY_APP_ID: process.env.PRIVY_APP_ID,
  KMS_KEY_RESOURCE: process.env.KMS_KEY_RESOURCE,
  SECRET_ENV_MAP: process.env.SECRET_ENV_MAP,
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
  SELLER_NAME: process.env.SELLER_NAME,
  CHECKOUT_ENABLED: "false",
  PAYMENT_PROVIDER: "disabled",
  ENS_ENABLED: process.env.ENS_ENABLED ?? "false",
  ENS_WRITE_ENABLED: process.env.ENS_WRITE_ENABLED ?? "false",
  TRUST_PROXY: "false",
};
module.exports = {
  apps: [
    {
      name: "nftech-app",
      cwd,
      script: "node_modules/next/dist/bin/next",
      args: "start --hostname 127.0.0.1 --port 3100",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "768M",
      kill_timeout: 10000,
      env,
    },
    {
      name: "nftech-worker",
      cwd,
      script: "src/worker/index.ts",
      interpreter: "node",
      node_args: "--import tsx",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "384M",
      kill_timeout: 15000,
      env,
    },
  ],
};

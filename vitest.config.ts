import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30000,
    env: { APP_MODE: "demo", NEXT_PUBLIC_APP_MODE: "demo", APP_ORIGIN: "http://localhost:3000" },
  },
});

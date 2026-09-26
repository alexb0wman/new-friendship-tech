import { z } from "zod";

const bool = (value: string | undefined, fallback = false) =>
  value === undefined ? fallback : value === "true";
export function isDemo() {
  const demo = process.env.APP_MODE === "demo";
  if (demo && process.env.NODE_ENV === "production")
    throw new Error("Demo mode is forbidden in a production process. Use npm run demo locally.");
  return demo;
}
/** Public alpha: simulated chain and World, Privy stays on. Never a live Sepolia write. */
export function previewEns() {
  return process.env.ENS_SIMULATED === "true";
}
export function config() {
  const demo = isDemo();
  const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
  new URL(origin);
  if (!demo && !origin.startsWith("https://") && process.env.NODE_ENV === "production") {
    throw new Error("APP_ORIGIN must use HTTPS in production.");
  }
  return {
    demo,
    origin,
    databaseUrl: process.env.DATABASE_URL,
    privyAppId: process.env.PRIVY_APP_ID ?? process.env.NEXT_PUBLIC_PRIVY_APP_ID,
    privySecret: process.env.PRIVY_APP_SECRET,
    enrollmentOpen: bool(process.env.ENROLLMENT_OPEN, true),
    directoryEnabled: bool(process.env.MEMBER_DIRECTORY_ENABLED, true),
    nowEnabled: bool(process.env.NOW_ENABLED, true),
    checkoutEnabled: bool(process.env.CHECKOUT_ENABLED),
    ensEnabled: bool(process.env.ENS_ENABLED),
    ensWriteEnabled: bool(process.env.ENS_WRITE_ENABLED),
    trustProxy: bool(process.env.TRUST_PROXY),
  };
}
export function productionRequirements() {
  const required = [
    "DATABASE_URL",
    "PRIVY_APP_SECRET",
    "KMS_KEY_RESOURCE",
    "APP_ORIGIN",
    "SUPPORT_EMAIL",
    "SELLER_NAME",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (!config().privyAppId) missing.push("PRIVY_APP_ID");
  if (process.env.APP_MODE !== "production") missing.push("APP_MODE=production");
  if (process.env.NEXT_PUBLIC_APP_MODE !== "production")
    missing.push("NEXT_PUBLIC_APP_MODE=production");
  return missing;
}
export const uuid = z.string().uuid();
export const walletAddress = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .transform((value) => value.toLowerCase());
export const txHash = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/)
  .transform((value) => value.toLowerCase());

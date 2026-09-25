import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { KeyManagementServiceClient } from "@google-cloud/kms";
import { z } from "zod";
import { isDemo } from "./config";

export const contactSchema = z
  .object({
    type: z.enum(["Telegram", "Email"]),
    value: z.string().trim().min(3).max(160),
    shareOnAcceptance: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "Telegram" && !/^@?[a-zA-Z0-9_]{5,32}$/.test(data.value))
      ctx.addIssue({ code: "custom", message: "Enter a Telegram username, not a URL." });
    if (data.type === "Email" && !z.email().safeParse(data.value).success)
      ctx.addIssue({ code: "custom", message: "Enter a valid email address." });
  });
export type SealedContact = {
  ciphertext: string;
  iv: string;
  tag: string;
  wrappedKey: string;
  mode: "kms" | "demo";
};
let kms: KeyManagementServiceClient | undefined;
function client() {
  return (kms ??= new KeyManagementServiceClient());
}
function bytes(value: Uint8Array | string | null | undefined): Buffer {
  if (!value) throw new Error("KMS returned no key material");
  return typeof value === "string" ? Buffer.from(value, "base64") : Buffer.from(value);
}
export async function sealContact(
  userId: string,
  contact: { type: string; value: string },
): Promise<SealedContact> {
  const key = randomBytes(32),
    iv = randomBytes(12),
    aad = Buffer.from("nftech:contact:" + userId);
  try {
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(contact), "utf8"),
      cipher.final(),
    ]);
    const demo = isDemo();
    let wrappedKey: string;
    if (demo) wrappedKey = key.toString("base64");
    else {
      if (!process.env.KMS_KEY_RESOURCE) throw new Error("KMS_KEY_RESOURCE required for contacts");
      const [response] = await client().encrypt({
        name: process.env.KMS_KEY_RESOURCE,
        plaintext: key,
        additionalAuthenticatedData: aad,
      });
      wrappedKey = bytes(response.ciphertext).toString("base64");
    }
    return {
      ciphertext: ciphertext.toString("base64"),
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      wrappedKey,
      mode: demo ? "demo" : "kms",
    };
  } finally {
    key.fill(0);
  }
}
export async function openContact(
  userId: string,
  sealed: SealedContact,
): Promise<{ type: string; value: string }> {
  const aad = Buffer.from("nftech:contact:" + userId);
  let key: Buffer;
  if (sealed.mode === "demo") {
    if (!isDemo()) throw new Error("Demo encryption is forbidden outside demo mode");
    key = Buffer.from(sealed.wrappedKey, "base64");
  } else {
    const [response] = await client().decrypt({
      name: process.env.KMS_KEY_RESOURCE,
      ciphertext: Buffer.from(sealed.wrappedKey, "base64"),
      additionalAuthenticatedData: aad,
    });
    key = bytes(response.plaintext);
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.iv, "base64"));
    decipher.setAAD(aad);
    decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(sealed.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
    return z.object({ type: z.string(), value: z.string() }).parse(JSON.parse(plaintext));
  } finally {
    key.fill(0);
  }
}

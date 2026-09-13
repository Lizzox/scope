import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function getKey() {
  const raw = process.env.SCOPE_ENCRYPTION_KEY;
  if (!raw) throw new Error("SCOPE_ENCRYPTION_KEY is not configured");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("SCOPE_ENCRYPTION_KEY must contain exactly 32 base64-encoded bytes");
  return key;
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(payload: string) {
  const [version, iv, tag, encrypted] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Unsupported encrypted secret format");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

export function redactSecrets(value: string) {
  return value.replace(/(sk-[a-zA-Z0-9_-]{8})[a-zA-Z0-9_-]+/g, "$1…redacted").replace(/("?(?:api[_-]?key|authorization)"?\s*[:=]\s*"?)[^"\s]+/gi, "$1[redacted]");
}

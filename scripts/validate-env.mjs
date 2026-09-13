const missing = ["DATABASE_URL", "SCOPE_ENCRYPTION_KEY", "SCOPE_SESSION_SECRET"].filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(", ")}`);

if (Buffer.from(process.env.SCOPE_ENCRYPTION_KEY, "base64").length !== 32) {
  throw new Error("SCOPE_ENCRYPTION_KEY must contain exactly 32 base64-encoded bytes");
}
if (process.env.SCOPE_SESSION_SECRET.length < 32) {
  throw new Error("SCOPE_SESSION_SECRET must contain at least 32 characters");
}
if (process.env.NEXT_PUBLIC_APP_URL) new URL(process.env.NEXT_PUBLIC_APP_URL);

console.log("Scope environment validation passed.");

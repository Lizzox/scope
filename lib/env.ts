import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  SCOPE_ENCRYPTION_KEY: z.string().min(1),
  SCOPE_SESSION_SECRET: z.string().min(32),
  SCOPE_SETUP_TOKEN: z.string().min(24).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

export function getEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) throw new Error(`Invalid server configuration: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  return result.data;
}

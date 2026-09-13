import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { rateLimitBuckets } from "@/lib/db/schema";
import { ApiError } from "./errors";

export async function enforceRateLimit(key: string, maximum: number, windowSeconds: number) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowSeconds * 1000);
  const record = await getDb().transaction(async (tx) => {
    await tx.delete(rateLimitBuckets).where(and(eq(rateLimitBuckets.key, key), lt(rateLimitBuckets.expiresAt, now)));
    const [row] = await tx.insert(rateLimitBuckets).values({ key, count: 1, windowStartedAt: now, expiresAt })
      .onConflictDoUpdate({ target: rateLimitBuckets.key, set: { count: sql`${rateLimitBuckets.count} + 1` } }).returning();
    return row;
  });
  if (record.count > maximum) throw new ApiError(429, "rate_limited", "Zu viele Anfragen. Bitte später erneut versuchen.", { retryAfter: Math.max(1, Math.ceil((record.expiresAt.getTime() - Date.now()) / 1000)) });
}

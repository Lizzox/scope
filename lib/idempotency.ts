import "server-only";
import { createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { idempotencyKeys } from "@/lib/db/schema";
import { ApiError } from "@/lib/http/errors";

export async function idempotencyLookup(request: NextRequest, workspaceId: string, body: unknown) {
  const key = request.headers.get("idempotency-key");
  if (!key || key.length > 200) throw new ApiError(400, "idempotency_key_required", "Idempotency-Key fehlt.");
  const requestHash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const [existing] = await getDb().select().from(idempotencyKeys).where(and(eq(idempotencyKeys.workspaceId, workspaceId), eq(idempotencyKeys.key, key), gt(idempotencyKeys.expiresAt, new Date()))).limit(1);
  if (existing && existing.requestHash !== requestHash) throw new ApiError(409, "idempotency_conflict", "Dieser Idempotency-Key wurde für eine andere Anfrage verwendet.");
  return { key, requestHash, cached: existing?.response };
}

export async function saveIdempotency(workspaceId: string, key: string, requestHash: string, response: unknown) {
  await getDb().insert(idempotencyKeys).values({ workspaceId, key, requestHash, response, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }).onConflictDoNothing();
}

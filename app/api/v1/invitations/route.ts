import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { invitations } from "@/lib/db/schema";
import { recordActivity } from "@/lib/activity";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { requestFingerprint } from "@/lib/http/api";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { invitationCreateSchema, uuidSchema } from "@/lib/validation";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
export async function GET(request: NextRequest) { try { const workspaceId = uuidSchema.parse(request.nextUrl.searchParams.get("workspaceId")); await requireWorkspace(request, workspaceId, ["owner", "admin"]); return ok(await getDb().select({ id: invitations.id, role: invitations.role, expiresAt: invitations.expiresAt, usedAt: invitations.usedAt, revokedAt: invitations.revokedAt, createdAt: invitations.createdAt }).from(invitations).where(eq(invitations.workspaceId, workspaceId)).orderBy(desc(invitations.createdAt))); } catch (error) { return apiError(error); } }
export async function POST(request: NextRequest) { try { assertSameOrigin(request); const input = await parseJson(request, invitationCreateSchema); const access = await requireWorkspace(request, input.workspaceId, ["owner", "admin"]); await enforceRateLimit(`invitation:${input.workspaceId}:${requestFingerprint(request)}`, 30, 3600); const token = randomBytes(32).toString("base64url"); const expiresAt = new Date(Date.now() + input.expiresInDays * 86400_000); const [invitation] = await getDb().insert(invitations).values({ workspaceId: input.workspaceId, tokenHash: hash(token), role: input.role, expiresAt }).returning(); await recordActivity({ workspaceId: input.workspaceId, actorId: access.user.id, entityType: "invitation", entityId: invitation.id, action: "invitation.created", payload: { role: input.role, expiresAt } }); const publicOrigin = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin; return ok({ id: invitation.id, token, url: `${publicOrigin}/join?token=${token}`, role: invitation.role, expiresAt }, { status: 201 }); } catch (error) { return apiError(error); } }

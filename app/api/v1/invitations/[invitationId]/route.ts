import { and, eq, gt, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { invitations } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";

type Context = { params: Promise<{ invitationId: string }> };
export async function DELETE(request: NextRequest, context: Context) { try { assertSameOrigin(request); const { invitationId } = await context.params; const [invite] = await getDb().select().from(invitations).where(and(eq(invitations.id, invitationId), isNull(invitations.revokedAt), isNull(invitations.usedAt), gt(invitations.expiresAt, new Date()))).limit(1); if (!invite) throw new ApiError(404, "invitation_not_found", "Einladung nicht gefunden oder nicht mehr aktiv."); await requireWorkspace(request, invite.workspaceId, ["owner", "admin"]); const [updated] = await getDb().update(invitations).set({ revokedAt: new Date(), updatedAt: new Date() }).where(eq(invitations.id, invitationId)).returning(); return ok(updated); } catch (error) { return apiError(error); } }

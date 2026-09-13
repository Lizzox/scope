import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { memberships } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";
import { membershipUpdateSchema } from "@/lib/validation";

type Context = { params: Promise<{ workspaceId: string; membershipId: string }> };
async function target(workspaceId: string, membershipId: string) { const [membership] = await getDb().select().from(memberships).where(and(eq(memberships.id, membershipId), eq(memberships.workspaceId, workspaceId))).limit(1); if (!membership) throw new ApiError(404, "membership_not_found", "Mitgliedschaft nicht gefunden."); if (membership.role === "owner") throw new ApiError(409, "owner_protected", "Der Workspace-Owner kann nicht verändert oder entfernt werden."); return membership; }
export async function PATCH(request: NextRequest, context: Context) { try { assertSameOrigin(request); const { workspaceId, membershipId } = await context.params; await requireWorkspace(request, workspaceId, ["owner", "admin"]); await target(workspaceId, membershipId); const input = await parseJson(request, membershipUpdateSchema); const [membership] = await getDb().update(memberships).set({ role: input.role, updatedAt: new Date() }).where(eq(memberships.id, membershipId)).returning(); return ok(membership); } catch (error) { return apiError(error); } }
export async function DELETE(request: NextRequest, context: Context) { try { assertSameOrigin(request); const { workspaceId, membershipId } = await context.params; const access = await requireWorkspace(request, workspaceId, ["owner", "admin"]); const membership = await target(workspaceId, membershipId); if (access.membership.role === "admin" && membership.role === "admin") throw new ApiError(403, "forbidden", "Admins können keine anderen Admins entfernen."); await getDb().delete(memberships).where(eq(memberships.id, membershipId)); return ok({ removed: true }); } catch (error) { return apiError(error); } }

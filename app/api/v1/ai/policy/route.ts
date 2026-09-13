import { eq, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { aiPolicies, projects } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";
import { aiPolicyUpdateSchema, uuidSchema } from "@/lib/validation";

export async function GET(request: NextRequest) { try { const workspaceId = uuidSchema.parse(request.nextUrl.searchParams.get("workspaceId")); await requireWorkspace(request, workspaceId); const [policy] = await getDb().select().from(aiPolicies).where(eq(aiPolicies.workspaceId, workspaceId)).limit(1); return ok(policy ?? null); } catch (error) { return apiError(error); } }
export async function PATCH(request: NextRequest) { try { assertSameOrigin(request); const workspaceId = uuidSchema.parse(request.nextUrl.searchParams.get("workspaceId")); await requireWorkspace(request, workspaceId, ["owner", "admin"]); const input = await parseJson(request, aiPolicyUpdateSchema); if (input.allowedProjectIds?.length) { const rows = await getDb().select({ id: projects.id }).from(projects).where(inArray(projects.id, input.allowedProjectIds)); if (rows.length !== input.allowedProjectIds.length || rows.some((row) => !input.allowedProjectIds!.includes(row.id))) throw new ApiError(422, "invalid_project_scope", "Mindestens ein Projekt gehört nicht zum Workspace."); const workspaceProjects = await getDb().select({ id: projects.id }).from(projects).where(eq(projects.workspaceId, workspaceId)); if (rows.some((row) => !workspaceProjects.some((project) => project.id === row.id))) throw new ApiError(422, "invalid_project_scope", "Mindestens ein Projekt gehört nicht zum Workspace."); } const [policy] = await getDb().update(aiPolicies).set({ ...input, updatedAt: new Date() }).where(eq(aiPolicies.workspaceId, workspaceId)).returning(); if (!policy) throw new ApiError(404, "ai_policy_not_found", "KI-Richtlinie nicht gefunden."); return ok(policy); } catch (error) { return apiError(error); } }

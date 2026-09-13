import { and, asc, eq, or } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { projects, savedViews } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";
import { savedViewCreateSchema, uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try { const workspaceId = uuidSchema.parse(request.nextUrl.searchParams.get("workspaceId")); const access = await requireWorkspace(request, workspaceId); return ok(await getDb().select().from(savedViews).where(and(eq(savedViews.workspaceId, workspaceId), or(eq(savedViews.ownerId, access.user.id), eq(savedViews.scope, "project"), eq(savedViews.scope, "workspace")))).orderBy(asc(savedViews.name))); } catch (error) { return apiError(error); }
}
export async function POST(request: NextRequest) {
  try { assertSameOrigin(request); const input = await parseJson(request, savedViewCreateSchema); const access = await requireWorkspace(request, input.workspaceId); if (input.scope === "workspace" && !["owner", "admin"].includes(access.membership.role)) throw new ApiError(403, "role_required", "Workspace-Ansichten können nur Owner und Admins erstellen."); if (input.projectId) { const [project] = await getDb().select().from(projects).where(and(eq(projects.id, input.projectId), eq(projects.workspaceId, input.workspaceId))).limit(1); if (!project) throw new ApiError(404, "project_not_found", "Projekt nicht gefunden."); } const [view] = await getDb().insert(savedViews).values({ ...input, ownerId: access.user.id }).returning(); return ok(view, { status: 201 }); } catch (error) { return apiError(error); }
}

import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { projects } from "@/lib/db/schema";
import { requireProject } from "@/lib/auth/resources";
import { recordActivity } from "@/lib/activity";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { projectUpdateSchema } from "@/lib/validation";

type Context = { params: Promise<{ projectId: string }> };
export async function GET(request: NextRequest, context: Context) { try { const { projectId } = await context.params; return ok((await requireProject(request, projectId)).project); } catch (error) { return apiError(error); } }
export async function PATCH(request: NextRequest, context: Context) { try { assertSameOrigin(request); const { projectId } = await context.params; const access = await requireProject(request, projectId, ["owner", "admin"]); const input = await parseJson(request, projectUpdateSchema); const [project] = await getDb().update(projects).set({ ...input, updatedAt: new Date() }).where(eq(projects.id, projectId)).returning(); await recordActivity({ workspaceId: access.project.workspaceId, actorId: access.user.id, entityType: "project", entityId: projectId, action: "project.updated", payload: input, undoPayload: access.project }); return ok(project); } catch (error) { return apiError(error); } }
export async function DELETE(request: NextRequest, context: Context) { try { assertSameOrigin(request); const { projectId } = await context.params; const access = await requireProject(request, projectId, ["owner"]); const [project] = await getDb().update(projects).set({ status: "paused", updatedAt: new Date() }).where(eq(projects.id, projectId)).returning(); await recordActivity({ workspaceId: access.project.workspaceId, actorId: access.user.id, entityType: "project", entityId: projectId, action: "project.archived", undoPayload: { status: access.project.status } }); return ok(project); } catch (error) { return apiError(error); } }

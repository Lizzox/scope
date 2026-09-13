import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireProject } from "@/lib/auth/resources";
import { getDb } from "@/lib/db/client";
import { memberships, milestones, projects, tasks, workspaces } from "@/lib/db/schema";
import { recordActivity } from "@/lib/activity";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { idempotencyLookup, saveIdempotency } from "@/lib/idempotency";
import { taskCreateSchema, uuidSchema } from "@/lib/validation";
import { ApiError } from "@/lib/http/errors";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) { try { const projectId = request.nextUrl.searchParams.get("projectId"); const workspaceId = request.nextUrl.searchParams.get("workspaceId"); if (projectId) { await requireProject(request, uuidSchema.parse(projectId)); return ok(await getDb().select().from(tasks).where(and(eq(tasks.projectId, projectId), isNull(tasks.deletedAt))).orderBy(asc(tasks.position))); } if (!workspaceId) throw new Error("workspaceId or projectId required"); const access = await import("@/lib/auth/access").then(({ requireWorkspace }) => requireWorkspace(request, uuidSchema.parse(workspaceId))); const projectRows = await getDb().select({ id: projects.id }).from(projects).where(eq(projects.workspaceId, workspaceId)); return ok(projectRows.length ? await getDb().select().from(tasks).where(and(inArray(tasks.projectId, projectRows.map((item) => item.id)), isNull(tasks.deletedAt))).orderBy(asc(tasks.position)) : []); void access; } catch (error) { return apiError(error); } }
export async function POST(request: NextRequest) {
  try { assertSameOrigin(request); const input = await parseJson(request, taskCreateSchema); const access = await requireProject(request, input.projectId); const idempotency = await idempotencyLookup(request, access.project.workspaceId, input); if (idempotency.cached) return ok(idempotency.cached);
    if (input.assigneeId) { const [member] = await getDb().select({ id: memberships.id }).from(memberships).where(and(eq(memberships.workspaceId, access.project.workspaceId), eq(memberships.userId, input.assigneeId))).limit(1); if (!member) throw new ApiError(422, "invalid_assignee", "Die ausgewählte Person gehört nicht zum Workspace."); }
    if (input.milestoneId) { const [milestone] = await getDb().select({ id: milestones.id }).from(milestones).where(and(eq(milestones.id, input.milestoneId), eq(milestones.projectId, input.projectId))).limit(1); if (!milestone) throw new ApiError(422, "invalid_milestone", "Der Meilenstein gehört nicht zum Projekt."); }
    const task = await getDb().transaction(async (tx) => { const [workspace] = await tx.update(workspaces).set({ nextTaskNumber: sql`${workspaces.nextTaskNumber} + 1`, updatedAt: new Date() }).where(eq(workspaces.id, access.project.workspaceId)).returning({ number: workspaces.nextTaskNumber }); const [created] = await tx.insert(tasks).values({ projectId: input.projectId, milestoneId: input.milestoneId, title: input.title, description: input.description, status: input.status, priority: input.priority, dueDate: input.dueDate ? new Date(`${input.dueDate}T12:00:00Z`) : null, assigneeId: input.assigneeId, parentId: input.parentId, number: workspace.number - 1, position: workspace.number - 1, createdBy: access.user.id }).returning(); return created; });
    await recordActivity({ workspaceId: access.project.workspaceId, actorId: access.user.id, entityType: "task", entityId: task.id, action: "task.created", payload: task }); if (task.assigneeId && task.assigneeId !== access.user.id) await createNotification({ workspaceId: access.project.workspaceId, userId: task.assigneeId, actorId: access.user.id, type: "task.assigned", title: "Neue Aufgabe zugewiesen", body: task.title, entityType: "task", entityId: task.id }); await saveIdempotency(access.project.workspaceId, idempotency.key, idempotency.requestHash, task); return ok({ ...task, key: `${access.project.key}-${task.number}` }, { status: 201 });
  } catch (error) { return apiError(error); }
}

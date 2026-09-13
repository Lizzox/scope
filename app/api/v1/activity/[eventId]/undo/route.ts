import { and, eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { activityEvents, tasks } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";

type Context = { params: Promise<{ eventId: string }> };
export async function POST(request: NextRequest, context: Context) { try { assertSameOrigin(request); const { eventId } = await context.params; const [event] = await getDb().select().from(activityEvents).where(eq(activityEvents.id, eventId)).limit(1); if (!event) throw new ApiError(404, "activity_not_found", "Aktivität nicht gefunden."); const access = await requireWorkspace(request, event.workspaceId); if (event.undoneAt) throw new ApiError(409, "already_undone", "Diese Änderung wurde bereits rückgängig gemacht."); if (event.entityType !== "task" || !event.undoPayload) throw new ApiError(422, "not_undoable", "Diese Änderung kann nicht rückgängig gemacht werden."); const undo = event.undoPayload as Record<string, unknown>; await getDb().transaction(async (tx) => { if (undo.created === true) await tx.update(tasks).set({ deletedAt: new Date(), version: sql`${tasks.version} + 1`, updatedAt: new Date() }).where(eq(tasks.id, event.entityId)); else {
    const values: Record<string, unknown> = { version: sql`${tasks.version} + 1`, updatedAt: new Date() };
    const has = (key: string) => Object.prototype.hasOwnProperty.call(undo, key);
    if (has("title")) values.title = String(undo.title);
    if (has("description")) values.description = String(undo.description ?? "");
    if (has("status")) values.status = undo.status;
    if (has("priority")) values.priority = undo.priority;
    if (has("position")) values.position = Number(undo.position);
    if (has("assigneeId")) values.assigneeId = typeof undo.assigneeId === "string" ? undo.assigneeId : null;
    if (has("dueDate")) values.dueDate = undo.dueDate ? new Date(String(undo.dueDate)) : null;
    if (has("completedAt")) values.completedAt = undo.completedAt ? new Date(String(undo.completedAt)) : null;
    if (has("deletedAt")) values.deletedAt = undo.deletedAt ? new Date(String(undo.deletedAt)) : null;
    await tx.update(tasks).set(values).where(eq(tasks.id, event.entityId));
  } await tx.update(activityEvents).set({ undoneAt: new Date() }).where(and(eq(activityEvents.id, eventId), eq(activityEvents.workspaceId, event.workspaceId))); await tx.insert(activityEvents).values({ workspaceId: event.workspaceId, actorId: access.user.id, entityType: "task", entityId: event.entityId, action: "activity.undone", payload: { eventId } }); }); return ok({ undone: true, eventId }); } catch (error) { return apiError(error); } }

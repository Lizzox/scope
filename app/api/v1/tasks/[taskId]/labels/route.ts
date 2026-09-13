import { and, eq, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireTask } from "@/lib/auth/resources";
import { recordActivity } from "@/lib/activity";
import { getDb } from "@/lib/db/client";
import { labels, taskLabels } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";
import { taskLabelsUpdateSchema } from "@/lib/validation";

type Context = { params: Promise<{ taskId: string }> };
export async function PUT(request: NextRequest, context: Context) { try { assertSameOrigin(request); const { taskId } = await context.params; const access = await requireTask(request, taskId); const input = await parseJson(request, taskLabelsUpdateSchema); const valid = input.labelIds.length ? await getDb().select({ id: labels.id }).from(labels).where(and(eq(labels.workspaceId, access.project.workspaceId), inArray(labels.id, input.labelIds))) : []; if (valid.length !== input.labelIds.length) throw new ApiError(422, "invalid_labels", "Mindestens ein Label gehört nicht zum Workspace."); await getDb().transaction(async (tx) => { await tx.delete(taskLabels).where(eq(taskLabels.taskId, taskId)); if (input.labelIds.length) await tx.insert(taskLabels).values(input.labelIds.map((labelId) => ({ taskId, labelId }))); }); await recordActivity({ workspaceId: access.project.workspaceId, actorId: access.user.id, entityType: "task", entityId: taskId, action: "task.labels_updated", payload: input }); return ok(valid); } catch (error) { return apiError(error); } }

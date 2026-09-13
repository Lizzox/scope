import { asc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireTask } from "@/lib/auth/resources";
import { getDb } from "@/lib/db/client";
import { comments, users } from "@/lib/db/schema";
import { recordActivity } from "@/lib/activity";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { commentCreateSchema } from "@/lib/validation";
import { createNotification } from "@/lib/notifications";

type Context = { params: Promise<{ taskId: string }> };
export async function GET(request: NextRequest, context: Context) {
  try {
    const { taskId } = await context.params;
    await requireTask(request, taskId);
    const rows = await getDb()
      .select({
        id: comments.id,
        body: comments.body,
        createdAt: comments.createdAt,
        author: { id: users.id, name: users.name },
      })
      .from(comments)
      .innerJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.taskId, taskId))
      .orderBy(asc(comments.createdAt));
    return ok(rows);
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const { taskId } = await context.params;
    const access = await requireTask(request, taskId);
    const input = await parseJson(request, commentCreateSchema);
    const [comment] = await getDb()
      .insert(comments)
      .values({ taskId, authorId: access.user.id, body: input.body })
      .returning();
    await recordActivity({
      workspaceId: access.project.workspaceId,
      actorId: access.user.id,
      entityType: "comment",
      entityId: comment.id,
      action: "comment.created",
      payload: { taskId },
    });
    if (access.task.assigneeId && access.task.assigneeId !== access.user.id)
      await createNotification({
        workspaceId: access.project.workspaceId,
        userId: access.task.assigneeId,
        actorId: access.user.id,
        type: "comment.created",
        title: `Neuer Kommentar in ${access.project.key}-${access.task.number}`,
        body: input.body.slice(0, 240),
        entityType: "task",
        entityId: taskId,
      });
    return ok(comment, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

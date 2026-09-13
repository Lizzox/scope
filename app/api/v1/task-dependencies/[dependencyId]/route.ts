import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { recordActivity } from "@/lib/activity";
import { requireTask } from "@/lib/auth/resources";
import { getDb } from "@/lib/db/client";
import { taskDependencies } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";

type Context = { params: Promise<{ dependencyId: string }> };
export async function DELETE(request: NextRequest, context: Context) {
  try { assertSameOrigin(request); const { dependencyId } = await context.params; const [dependency] = await getDb().select().from(taskDependencies).where(eq(taskDependencies.id, dependencyId)).limit(1); if (!dependency) throw new ApiError(404, "dependency_not_found", "Abhängigkeit nicht gefunden."); const access = await requireTask(request, dependency.blockerTaskId); await getDb().delete(taskDependencies).where(eq(taskDependencies.id, dependencyId)); await recordActivity({ workspaceId: access.project.workspaceId, actorId: access.user.id, entityType: "task_dependency", entityId: dependencyId, action: "dependency.deleted", undoPayload: dependency }); return ok(dependency); } catch (error) { return apiError(error); }
}

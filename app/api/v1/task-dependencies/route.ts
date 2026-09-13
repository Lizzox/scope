import { eq, or } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { recordActivity } from "@/lib/activity";
import { requireTask } from "@/lib/auth/resources";
import { getDb } from "@/lib/db/client";
import { taskDependencies } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";
import { dependencyCreateSchema, uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try { const taskId = uuidSchema.parse(request.nextUrl.searchParams.get("taskId")); await requireTask(request, taskId); return ok(await getDb().select().from(taskDependencies).where(or(eq(taskDependencies.blockerTaskId, taskId), eq(taskDependencies.blockedTaskId, taskId)))); } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request); const input = await parseJson(request, dependencyCreateSchema);
    const [blocker, blocked] = await Promise.all([requireTask(request, input.blockerTaskId), requireTask(request, input.blockedTaskId)]);
    if (blocker.project.workspaceId !== blocked.project.workspaceId) throw new ApiError(403, "cross_workspace_dependency", "Abhängigkeiten sind nur innerhalb eines Workspace erlaubt.");
    const edges = await getDb().select().from(taskDependencies);
    const adjacency = new Map<string, string[]>();
    for (const edge of edges) adjacency.set(edge.blockerTaskId, [...(adjacency.get(edge.blockerTaskId) ?? []), edge.blockedTaskId]);
    adjacency.set(input.blockerTaskId, [...(adjacency.get(input.blockerTaskId) ?? []), input.blockedTaskId]);
    const seen = new Set<string>(); const stack = [input.blockedTaskId];
    while (stack.length) { const current = stack.pop()!; if (current === input.blockerTaskId) throw new ApiError(422, "dependency_cycle", "Diese Abhängigkeit würde einen Zyklus erzeugen."); if (seen.has(current)) continue; seen.add(current); stack.push(...(adjacency.get(current) ?? [])); }
    const [dependency] = await getDb().insert(taskDependencies).values({ ...input, createdBy: blocker.user.id }).returning();
    await recordActivity({ workspaceId: blocker.project.workspaceId, actorId: blocker.user.id, entityType: "task_dependency", entityId: dependency.id, action: "dependency.created", payload: dependency });
    return ok(dependency, { status: 201 });
  } catch (error) { return apiError(error); }
}

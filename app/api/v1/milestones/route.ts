import { and, asc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { recordActivity } from "@/lib/activity";
import { requireProject } from "@/lib/auth/resources";
import { getDb } from "@/lib/db/client";
import { milestones } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { idempotencyLookup, saveIdempotency } from "@/lib/idempotency";
import { milestoneCreateSchema, uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const projectId = uuidSchema.parse(request.nextUrl.searchParams.get("projectId"));
    await requireProject(request, projectId);
    return ok(await getDb().select().from(milestones).where(eq(milestones.projectId, projectId)).orderBy(asc(milestones.position), asc(milestones.targetDate)));
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const input = await parseJson(request, milestoneCreateSchema);
    const access = await requireProject(request, input.projectId);
    const idempotency = await idempotencyLookup(request, access.project.workspaceId, input);
    if (idempotency.cached) return ok(idempotency.cached);
    const [milestone] = await getDb().insert(milestones).values({ ...input, targetDate: input.targetDate ? new Date(`${input.targetDate}T12:00:00Z`) : null, createdBy: access.user.id }).returning();
    await recordActivity({ workspaceId: access.project.workspaceId, actorId: access.user.id, entityType: "milestone", entityId: milestone.id, action: "milestone.created", payload: milestone });
    await saveIdempotency(access.project.workspaceId, idempotency.key, idempotency.requestHash, milestone);
    return ok(milestone, { status: 201 });
  } catch (error) { return apiError(error); }
}

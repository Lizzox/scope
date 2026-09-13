import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { recordActivity } from "@/lib/activity";
import { requireProject } from "@/lib/auth/resources";
import { getDb } from "@/lib/db/client";
import { milestones } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";
import { milestoneUpdateSchema } from "@/lib/validation";

type Context = { params: Promise<{ milestoneId: string }> };
async function access(request: NextRequest, milestoneId: string) {
  const [milestone] = await getDb().select().from(milestones).where(eq(milestones.id, milestoneId)).limit(1);
  if (!milestone) throw new ApiError(404, "milestone_not_found", "Meilenstein nicht gefunden.");
  return { milestone, ...(await requireProject(request, milestone.projectId)) };
}
export async function PATCH(request: NextRequest, context: Context) {
  try { assertSameOrigin(request); const { milestoneId } = await context.params; const current = await access(request, milestoneId); const input = await parseJson(request, milestoneUpdateSchema); const [milestone] = await getDb().update(milestones).set({ ...input, targetDate: input.targetDate === undefined ? current.milestone.targetDate : input.targetDate ? new Date(`${input.targetDate}T12:00:00Z`) : null, updatedAt: new Date() }).where(eq(milestones.id, milestoneId)).returning(); await recordActivity({ workspaceId: current.project.workspaceId, actorId: current.user.id, entityType: "milestone", entityId: milestoneId, action: "milestone.updated", payload: input, undoPayload: current.milestone }); return ok(milestone); } catch (error) { return apiError(error); }
}
export async function DELETE(request: NextRequest, context: Context) {
  try { assertSameOrigin(request); const { milestoneId } = await context.params; const current = await access(request, milestoneId); const [removed] = await getDb().delete(milestones).where(eq(milestones.id, milestoneId)).returning(); await recordActivity({ workspaceId: current.project.workspaceId, actorId: current.user.id, entityType: "milestone", entityId: milestoneId, action: "milestone.deleted", undoPayload: current.milestone }); return ok(removed); } catch (error) { return apiError(error); }
}

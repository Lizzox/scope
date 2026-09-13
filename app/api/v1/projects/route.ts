import { asc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { projects } from "@/lib/db/schema";
import { requireWorkspace } from "@/lib/auth/access";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { idempotencyLookup, saveIdempotency } from "@/lib/idempotency";
import { projectCreateSchema, uuidSchema } from "@/lib/validation";
import { recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) { try { const workspaceId = uuidSchema.parse(request.nextUrl.searchParams.get("workspaceId")); await requireWorkspace(request, workspaceId); return ok(await getDb().select().from(projects).where(eq(projects.workspaceId, workspaceId)).orderBy(asc(projects.createdAt))); } catch (error) { return apiError(error); } }
export async function POST(request: NextRequest) {
  try { assertSameOrigin(request); const input = await parseJson(request, projectCreateSchema); const { user } = await requireWorkspace(request, input.workspaceId, ["owner", "admin"]); const idempotency = await idempotencyLookup(request, input.workspaceId, input); if (idempotency.cached) return ok(idempotency.cached);
    const [project] = await getDb().insert(projects).values({ ...input, createdBy: user.id }).returning(); await recordActivity({ workspaceId: input.workspaceId, actorId: user.id, entityType: "project", entityId: project.id, action: "project.created", payload: project }); await saveIdempotency(input.workspaceId, idempotency.key, idempotency.requestHash, project); return ok(project, { status: 201 });
  } catch (error) { return apiError(error); }
}

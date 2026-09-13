import { asc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { recordActivity } from "@/lib/activity";
import { getDb } from "@/lib/db/client";
import { labels } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { labelCreateSchema, uuidSchema } from "@/lib/validation";

export async function GET(request: NextRequest) { try { const workspaceId = uuidSchema.parse(request.nextUrl.searchParams.get("workspaceId")); await requireWorkspace(request, workspaceId); return ok(await getDb().select().from(labels).where(eq(labels.workspaceId, workspaceId)).orderBy(asc(labels.name))); } catch (error) { return apiError(error); } }
export async function POST(request: NextRequest) { try { assertSameOrigin(request); const input = await parseJson(request, labelCreateSchema); const access = await requireWorkspace(request, input.workspaceId); const [label] = await getDb().insert(labels).values(input).returning(); await recordActivity({ workspaceId: input.workspaceId, actorId: access.user.id, entityType: "label", entityId: label.id, action: "label.created", payload: label }); return ok(label, { status: 201 }); } catch (error) { return apiError(error); } }

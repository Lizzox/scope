import { asc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { automations } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";
import { automationCreateSchema, uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) { try { const workspaceId = uuidSchema.parse(request.nextUrl.searchParams.get("workspaceId")); await requireWorkspace(request, workspaceId); return ok(await getDb().select().from(automations).where(eq(automations.workspaceId, workspaceId)).orderBy(asc(automations.name))); } catch (error) { return apiError(error); } }
export async function POST(request: NextRequest) { try { assertSameOrigin(request); const input = await parseJson(request, automationCreateSchema); const access = await requireWorkspace(request, input.workspaceId); if (input.status === "active" && !["owner", "admin"].includes(access.membership.role)) throw new ApiError(403, "automation_approval_required", "Aktive Automationen müssen durch Owner oder Admins freigegeben werden."); const [automation] = await getDb().insert(automations).values({ ...input, createdBy: access.user.id }).returning(); return ok(automation, { status: 201 }); } catch (error) { return apiError(error); } }

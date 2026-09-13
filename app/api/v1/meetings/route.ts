import { desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { meetings } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { meetingCreateSchema, uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) { try { const workspaceId = uuidSchema.parse(request.nextUrl.searchParams.get("workspaceId")); await requireWorkspace(request, workspaceId); return ok(await getDb().select().from(meetings).where(eq(meetings.workspaceId, workspaceId)).orderBy(desc(meetings.createdAt)).limit(100)); } catch (error) { return apiError(error); } }
export async function POST(request: NextRequest) { try { assertSameOrigin(request); const input = await parseJson(request, meetingCreateSchema); const access = await requireWorkspace(request, input.workspaceId); const [meeting] = await getDb().insert(meetings).values({ workspaceId: input.workspaceId, projectId: input.projectId, title: input.title, source: input.source, language: input.language, status: input.source === "live" ? "recording" : "uploaded", consentConfirmedAt: new Date(), consentConfirmedBy: access.user.id, createdBy: access.user.id, retentionUntil: new Date(Date.now() + 30 * 86400000) }).returning(); return ok(meeting, { status: 201 }); } catch (error) { return apiError(error); } }

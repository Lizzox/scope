import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { meetings } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";
import { meetingUpdateSchema } from "@/lib/validation";

type Context = { params: Promise<{ meetingId: string }> };
async function access(request: NextRequest, id: string) { const [meeting] = await getDb().select().from(meetings).where(eq(meetings.id, id)).limit(1); if (!meeting) throw new ApiError(404, "meeting_not_found", "Meeting nicht gefunden."); return { meeting, ...(await requireWorkspace(request, meeting.workspaceId)) }; }
export async function GET(request: NextRequest, context: Context) { try { const { meetingId } = await context.params; return ok((await access(request, meetingId)).meeting); } catch (error) { return apiError(error); } }
export async function PATCH(request: NextRequest, context: Context) { try { assertSameOrigin(request); const { meetingId } = await context.params; await access(request, meetingId); const input = await parseJson(request, meetingUpdateSchema); const [meeting] = await getDb().update(meetings).set({ ...input, updatedAt: new Date() }).where(eq(meetings.id, meetingId)).returning(); return ok(meeting); } catch (error) { return apiError(error); } }
export async function DELETE(request: NextRequest, context: Context) { try { assertSameOrigin(request); const { meetingId } = await context.params; const current = await access(request, meetingId); if (current.meeting.createdBy !== current.user.id && !["owner", "admin"].includes(current.membership.role)) throw new ApiError(403, "meeting_forbidden", "Meeting darf nicht gelöscht werden."); const [meeting] = await getDb().delete(meetings).where(eq(meetings.id, meetingId)).returning(); return ok(meeting); } catch (error) { return apiError(error); } }

import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { meetings } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";
import { enqueueJob } from "@/lib/jobs/queue";

type Context = { params: Promise<{ meetingId: string }> };
export async function POST(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const { meetingId } = await context.params;
    const [meeting] = await getDb()
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .limit(1);
    if (!meeting)
      throw new ApiError(404, "meeting_not_found", "Meeting nicht gefunden.");
    await requireWorkspace(request, meeting.workspaceId);
    if (!meeting.recordingAttachmentId)
      throw new ApiError(
        422,
        "recording_required",
        "Bitte zuerst eine Aufnahme hochladen.",
      );
    if (!process.env.SCOPE_TRANSCRIBER_URL)
      throw new ApiError(
        503,
        "transcriber_not_configured",
        "Der Transkriptionsdienst ist nicht eingerichtet. Owner können den lokalen Whisper-Dienst über die Installationskonfiguration aktivieren.",
      );
    await getDb()
      .update(meetings)
      .set({ status: "transcribing", errorCode: null, updatedAt: new Date() })
      .where(eq(meetings.id, meetingId));
    const job = await enqueueJob("meeting.transcribe", { meetingId });
    return ok(job, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}

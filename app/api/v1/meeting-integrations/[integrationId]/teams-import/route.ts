import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { meetingIntegrations, meetings } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";
import {
  getTeamsToken,
  integrationCredentials,
} from "@/lib/meeting-integrations";
import { transcriptFromVtt } from "@/lib/transcript";
import { teamsTranscriptImportSchema } from "@/lib/validation";

type Context = { params: Promise<{ integrationId: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const input = await parseJson(request, teamsTranscriptImportSchema);
    const { integrationId } = await context.params;
    const [integration] = await getDb()
      .select()
      .from(meetingIntegrations)
      .where(
        and(
          eq(meetingIntegrations.id, integrationId),
          eq(meetingIntegrations.provider, "teams"),
        ),
      )
      .limit(1);
    if (!integration)
      throw new ApiError(
        404,
        "teams_integration_not_found",
        "Teams-Integration nicht gefunden.",
      );
    const access = await requireWorkspace(request, integration.workspaceId, [
      "owner",
      "admin",
    ]);
    const config = integration.config as {
      tenantId: string;
      clientId: string;
      organizerUserId: string;
    };
    const secret = integrationCredentials<{ clientSecret: string }>(
      integration,
    );
    const token = await getTeamsToken({ ...config, ...secret });
    const graphHeaders = { authorization: `Bearer ${token}` };
    let onlineMeetingId = input.onlineMeetingId;
    if (/^https:\/\//i.test(onlineMeetingId)) {
      const escaped = onlineMeetingId.replace(/'/g, "''");
      const lookup = await fetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.organizerUserId)}/onlineMeetings?$filter=${encodeURIComponent(`JoinWebUrl eq '${escaped}'`)}`,
        { headers: graphHeaders, cache: "no-store" },
      );
      const payload = (await lookup.json()) as {
        value?: Array<{ id: string }>;
        error?: { message?: string };
      };
      if (!lookup.ok || !payload.value?.[0])
        throw new ApiError(
          422,
          "teams_meeting_not_found",
          payload.error?.message ?? "Teams-Meeting wurde nicht gefunden.",
        );
      onlineMeetingId = payload.value[0].id;
    }
    const base = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.organizerUserId)}/onlineMeetings/${encodeURIComponent(onlineMeetingId)}/transcripts`;
    const listResponse = await fetch(base, {
      headers: graphHeaders,
      cache: "no-store",
    });
    const list = (await listResponse.json()) as {
      value?: Array<{ id: string }>;
      error?: { message?: string };
    };
    if (!listResponse.ok || !list.value?.length)
      throw new ApiError(
        422,
        "teams_transcript_not_ready",
        list.error?.message ??
          "Noch kein Teams-Transkript verfügbar. Teams muss die Transkription im Meeting aktiviert haben.",
      );
    const transcriptResponse = await fetch(
      `${base}/${encodeURIComponent(list.value[0].id)}/content?$format=text/vtt`,
      { headers: graphHeaders, cache: "no-store" },
    );
    if (!transcriptResponse.ok)
      throw new ApiError(
        502,
        "teams_transcript_download_failed",
        "Teams-Transkript konnte nicht geladen werden.",
      );
    const transcript = transcriptFromVtt(await transcriptResponse.text());
    if (!transcript)
      throw new ApiError(
        422,
        "teams_transcript_empty",
        "Das Teams-Transkript ist leer.",
      );
    const [meeting] = await getDb()
      .insert(meetings)
      .values({
        workspaceId: integration.workspaceId,
        projectId: integration.projectId,
        title: input.title,
        source: "teams",
        status: "uploaded",
        transcript,
        language: "auto",
        consentConfirmedAt: new Date(),
        consentConfirmedBy: access.user.id,
        createdBy: access.user.id,
        retentionUntil: new Date(Date.now() + 30 * 86_400_000),
      })
      .returning();
    await getDb()
      .update(meetingIntegrations)
      .set({
        lastConnectedAt: new Date(),
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(meetingIntegrations.id, integration.id));
    return ok(meeting, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

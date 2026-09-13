import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { adapterFor, requireProvider } from "@/lib/ai/config";
import { assertAiPolicy } from "@/lib/ai/runs";
import { getDb } from "@/lib/db/client";
import { aiProposals, aiRuns, meetings } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";
import { meetingSummaryRequestSchema } from "@/lib/validation";

const meetingSummarySchema = z.object({
  overview: z.string(),
  topics: z.array(z.string()).max(20),
  decisions: z.array(z.object({ text: z.string(), timestamp: z.string().optional() })).max(50),
  actionItems: z.array(z.object({ title: z.string(), description: z.string().default(""), assigneeId: z.string().uuid().nullable().optional(), dueDate: z.string().nullable().optional(), timestamp: z.string().optional() })).max(50),
  risks: z.array(z.string()).max(30),
  openQuestions: z.array(z.string()).max(30),
});
type MeetingSummary = z.infer<typeof meetingSummarySchema>;

type Context = { params: Promise<{ meetingId: string }> };
export const maxDuration = 60;
export async function POST(request: NextRequest, context: Context) {
  let runId: string | undefined;
  try {
    assertSameOrigin(request);
    const { meetingId } = await context.params;
    const input = await parseJson(request, meetingSummaryRequestSchema);
    const [meeting] = await getDb().select().from(meetings).where(eq(meetings.id, meetingId)).limit(1);
    if (!meeting) throw new ApiError(404, "meeting_not_found", "Meeting nicht gefunden.");
    if (!meeting.projectId) throw new ApiError(422, "meeting_project_required", "Bitte das Meeting zuerst einem Projekt zuordnen.");
    if (!meeting.transcript.trim()) throw new ApiError(422, "transcript_required", "Für die Zusammenfassung wird ein Transkript benötigt.");
    const access = await assertAiPolicy(request, meeting.workspaceId, meeting.projectId, "suggest");
    const { config } = await requireProvider(request, meeting.workspaceId, input.providerConfigId);
    const [run] = await getDb().insert(aiRuns).values({ workspaceId: meeting.workspaceId, projectId: meeting.projectId, requestedBy: access.user.id, providerConfigId: input.providerConfigId, model: input.model, autonomy: "suggest", status: "running", prompt: `Meeting zusammenfassen: ${meeting.title}` }).returning();
    runId = run.id;
    await getDb().update(meetings).set({ status: "summarizing", updatedAt: new Date() }).where(eq(meetings.id, meetingId));
    const result = await adapterFor(config).generate<MeetingSummary>({ model: input.model, system: "Du bist Scope Meeting Assist. Fasse ausschließlich das bereitgestellte Transkript strukturiert zusammen. Erfinde keine Beschlüsse, Namen oder Termine. Aktionspunkte bleiben Vorschläge.", input: JSON.stringify({ meeting: { id: meeting.id, title: meeting.title, language: meeting.language }, transcript: meeting.transcript }), maxTokens: access.policy.maxTokensPerRun, schema: meetingSummarySchema });
    if (!result.data) throw new ApiError(502, "invalid_ai_response", "Der Provider lieferte keine gültige Meeting-Zusammenfassung.");
    const operations = result.data.actionItems.map((item, index) => ({ id: `meeting-action-${index + 1}`, type: "task.create" as const, projectId: meeting.projectId!, title: item.title, description: [item.description, item.timestamp ? `Quelle: ${item.timestamp}` : ""].filter(Boolean).join("\n\n") }));
    const [proposal] = await getDb().transaction(async (tx) => {
      await tx.update(meetings).set({ status: "review", summary: result.data!, updatedAt: new Date() }).where(eq(meetings.id, meeting.id));
      await tx.update(aiRuns).set({ status: "review", model: result.modelUsed ?? input.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, updatedAt: new Date() }).where(eq(aiRuns.id, run.id));
      const [created] = await tx.insert(aiProposals).values({ runId: run.id, summary: result.data!.overview, operations }).returning();
      return [created];
    });
    return ok({ meeting: { ...meeting, status: "review", summary: result.data }, proposal }, { status: 201 });
  } catch (error) {
    if (runId) await getDb().update(aiRuns).set({ status: "failed", errorCode: "meeting_summary_failed", updatedAt: new Date() }).where(eq(aiRuns.id, runId));
    return apiError(error);
  }
}

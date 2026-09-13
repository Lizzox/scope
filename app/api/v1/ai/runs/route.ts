import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { adapterFor, requireProvider } from "@/lib/ai/config";
import { plannerInput, plannerSystemPrompt } from "@/lib/ai/prompts";
import { AIProviderError, aiProposalSchema } from "@/lib/ai/provider";
import { applyProposal, assertAiPolicy } from "@/lib/ai/runs";
import { getDb } from "@/lib/db/client";
import { activityEvents, aiPolicies, aiProposals, aiRuns, attachments, automations, comments, labels, meetings, milestones, memberships, projects, recurrenceRules, savedViews, taskDependencies, tasks, users, workspaces } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { aiRunCreateSchema, uuidSchema } from "@/lib/validation";
import type { z } from "zod";

type AiProposal = z.infer<typeof aiProposalSchema>;

export const maxDuration = 60;
export async function GET(request: NextRequest) {
  try {
    const workspaceId = uuidSchema.parse(request.nextUrl.searchParams.get("workspaceId"));
    await requireWorkspace(request, workspaceId);
    const rows = await getDb().select({ run: aiRuns, proposal: aiProposals }).from(aiRuns).leftJoin(aiProposals, eq(aiProposals.runId, aiRuns.id)).where(eq(aiRuns.workspaceId, workspaceId)).orderBy(desc(aiRuns.createdAt)).limit(50);
    return ok(rows);
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  let runId: string | undefined;
  try {
    assertSameOrigin(request);
    const input = await parseJson(request, aiRunCreateSchema);
    const access = await assertAiPolicy(request, input.workspaceId, input.projectId, input.autonomy);
    await enforceRateLimit(`ai-run:${input.workspaceId}:${access.user.id}`, 20, 3600);
    const { config } = await requireProvider(request, input.workspaceId, input.providerConfigId);
    const [project] = await getDb().select().from(projects).where(and(eq(projects.id, input.projectId), eq(projects.workspaceId, input.workspaceId))).limit(1);
    if (!project) throw new ApiError(404, "project_not_found", "Projekt nicht gefunden.");
    const [run] = await getDb().insert(aiRuns).values({ ...input, requestedBy: access.user.id, status: "running" }).returning();
    runId = run.id;
    const workspaceProjects = await getDb().select({ id: projects.id, name: projects.name, description: projects.description, status: projects.status, key: projects.key }).from(projects).where(eq(projects.workspaceId, input.workspaceId));
    const projectIds = workspaceProjects.map((item) => item.id);
    const workspaceTasks = projectIds.length ? await getDb().select({ id: tasks.id, projectId: tasks.projectId, parentId: tasks.parentId, title: tasks.title, description: tasks.description, status: tasks.status, priority: tasks.priority, assigneeId: tasks.assigneeId, dueDate: tasks.dueDate }).from(tasks).where(and(inArray(tasks.projectId, projectIds), isNull(tasks.deletedAt))).limit(1000) : [];
    const selectedTaskIds = workspaceTasks.filter((item) => item.projectId === input.projectId).map((item) => item.id);
    const [workspace] = await getDb().select({ id: workspaces.id, name: workspaces.name, mode: workspaces.mode }).from(workspaces).where(eq(workspaces.id, input.workspaceId)).limit(1);
    const [workspaceMembers, workspaceLabels, recentActivity, projectComments, usage, workspaceMilestones, dependencies, recurring, viewRows, meetingRows, attachmentRows, automationRows] = await Promise.all([
      getDb().select({ id: users.id, name: users.name, role: memberships.role }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(eq(memberships.workspaceId, input.workspaceId)),
      getDb().select({ id: labels.id, name: labels.name, color: labels.color }).from(labels).where(eq(labels.workspaceId, input.workspaceId)),
      getDb().select({ entityType: activityEvents.entityType, entityId: activityEvents.entityId, action: activityEvents.action, actorType: activityEvents.actorType, createdAt: activityEvents.createdAt }).from(activityEvents).where(eq(activityEvents.workspaceId, input.workspaceId)).orderBy(desc(activityEvents.createdAt)).limit(100),
      selectedTaskIds.length ? getDb().select({ taskId: comments.taskId, body: comments.body, authorId: comments.authorId, createdAt: comments.createdAt }).from(comments).where(inArray(comments.taskId, selectedTaskIds)).orderBy(desc(comments.createdAt)).limit(500) : Promise.resolve([]),
      getDb().select({ model: aiRuns.model, inputTokens: aiRuns.inputTokens, outputTokens: aiRuns.outputTokens, status: aiRuns.status, createdAt: aiRuns.createdAt }).from(aiRuns).where(eq(aiRuns.workspaceId, input.workspaceId)).orderBy(desc(aiRuns.createdAt)).limit(50),
      projectIds.length ? getDb().select().from(milestones).where(inArray(milestones.projectId, projectIds)) : Promise.resolve([]),
      selectedTaskIds.length ? getDb().select().from(taskDependencies).where(inArray(taskDependencies.blockedTaskId, selectedTaskIds)) : Promise.resolve([]),
      projectIds.length ? getDb().select().from(recurrenceRules).where(inArray(recurrenceRules.projectId, projectIds)) : Promise.resolve([]),
      getDb().select().from(savedViews).where(eq(savedViews.workspaceId, input.workspaceId)).limit(100),
      getDb().select({ id: meetings.id, projectId: meetings.projectId, title: meetings.title, status: meetings.status, transcript: meetings.transcript, summary: meetings.summary, createdAt: meetings.createdAt }).from(meetings).where(eq(meetings.workspaceId, input.workspaceId)).orderBy(desc(meetings.createdAt)).limit(30),
      getDb().select({ id: attachments.id, projectId: attachments.projectId, entityType: attachments.entityType, entityId: attachments.entityId, originalName: attachments.originalName, mimeType: attachments.mimeType, sizeBytes: attachments.sizeBytes }).from(attachments).where(and(eq(attachments.workspaceId, input.workspaceId), eq(attachments.aiAllowed, true), isNull(attachments.deletedAt))).limit(100),
      getDb().select({ id: automations.id, projectId: automations.projectId, name: automations.name, status: automations.status, trigger: automations.trigger, conditions: automations.conditions, actions: automations.actions }).from(automations).where(eq(automations.workspaceId, input.workspaceId)).limit(100),
    ]);
    const result = await adapterFor(config).generate<AiProposal>({ model: input.model, system: plannerSystemPrompt(), input: plannerInput(input.prompt, { scopeVersion: "next", capabilities: ["projects", "milestones", "tasks", "subtasks", "dependencies", "recurrence", "assignees", "labels", "comments", "meetings", "attachments", "saved-views", "automations", "activity", "ai-proposals", "undo"], selectedProjectId: input.projectId, workspace, projects: workspaceProjects, milestones: workspaceMilestones, tasks: workspaceTasks, dependencies, recurrenceRules: recurring, members: workspaceMembers, labels: workspaceLabels, savedViews: viewRows, meetings: meetingRows.map((meeting) => ({ ...meeting, transcript: meeting.transcript.slice(0, 30_000) })), aiAllowedAttachments: attachmentRows, automations: automationRows, selectedProjectComments: projectComments, recentActivity, aiPolicy: access.policy, aiUsage: usage }), maxTokens: access.policy.maxTokensPerRun, schema: aiProposalSchema });
    if (!result.data) throw new ApiError(502, "invalid_ai_response", "Der Provider lieferte keinen gültigen Vorschlag.");
    const [proposal] = await getDb().transaction(async (tx) => {
      const [created] = await tx.insert(aiProposals).values({ runId: run.id, summary: result.data!.summary, operations: result.data!.operations }).returning();
      await tx.update(aiRuns).set({ status: "review", model: result.modelUsed ?? input.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, updatedAt: new Date() }).where(eq(aiRuns.id, run.id));
      return [created];
    });
    if (input.autonomy !== "suggest") {
      const applied = await applyProposal(request, proposal.id, result.data.operations.map((operation) => operation.id));
      return ok({ run: { ...run, model: result.modelUsed ?? input.model, status: "applied", inputTokens: result.inputTokens, outputTokens: result.outputTokens }, proposal, applied });
    }
    return ok({ run: { ...run, model: result.modelUsed ?? input.model, status: "review", inputTokens: result.inputTokens, outputTokens: result.outputTokens }, proposal }, { status: 201 });
  } catch (error) {
    if (runId) await getDb().update(aiRuns).set({ status: "failed", errorCode: error instanceof AIProviderError ? error.code : "execution_failed", updatedAt: new Date() }).where(eq(aiRuns.id, runId));
    return apiError(error);
  }
}

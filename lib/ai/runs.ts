import "server-only";
import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import {
  activityEvents,
  aiPolicies,
  aiProposals,
  aiRuns,
  labels,
  memberships,
  milestones,
  projects,
  taskDependencies,
  taskLabels,
  tasks,
  workspaces,
} from "@/lib/db/schema";
import { ApiError } from "@/lib/http/errors";
import { aiOperationSchema } from "./provider";

const level = { suggest: 0, automation: 1, agentic: 2 } as const;

export async function assertAiPolicy(
  request: NextRequest,
  workspaceId: string,
  projectId: string,
  requested: keyof typeof level,
) {
  const access = await requireWorkspace(request, workspaceId);
  const [policy] = await getDb()
    .select()
    .from(aiPolicies)
    .where(eq(aiPolicies.workspaceId, workspaceId))
    .limit(1);
  if (!policy)
    throw new ApiError(
      403,
      "ai_disabled",
      "KI ist in diesem Workspace nicht aktiviert.",
    );
  if (
    level[requested] > level[policy.maxAutonomy] ||
    level[requested] > level[access.user.preferredAutonomy]
  )
    throw new ApiError(
      403,
      "autonomy_exceeded",
      "Die gewählte Autonomiestufe ist nicht erlaubt.",
    );
  const allowedProjects = policy.allowedProjectIds as string[];
  if (allowedProjects.length && !allowedProjects.includes(projectId))
    throw new ApiError(
      403,
      "project_not_allowed",
      "KI ist für dieses Projekt nicht freigegeben.",
    );
  if (policy.monthlyTokenBudget) {
    const month = new Date();
    month.setUTCDate(1);
    month.setUTCHours(0, 0, 0, 0);
    const [usage] = await getDb()
      .select({
        tokens: sql<number>`coalesce(sum(coalesce(${aiRuns.inputTokens}, 0) + coalesce(${aiRuns.outputTokens}, 0)), 0)`,
      })
      .from(aiRuns)
      .where(
        and(eq(aiRuns.workspaceId, workspaceId), gte(aiRuns.createdAt, month)),
      );
    if (Number(usage.tokens) >= policy.monthlyTokenBudget)
      throw new ApiError(
        429,
        "ai_budget_exhausted",
        "Das monatliche KI-Budget ist aufgebraucht.",
      );
  }
  return { policy, ...access };
}

export async function applyProposal(
  request: NextRequest,
  proposalId: string,
  operationIds: string[],
) {
  const [record] = await getDb()
    .select({ proposal: aiProposals, run: aiRuns })
    .from(aiProposals)
    .innerJoin(aiRuns, eq(aiProposals.runId, aiRuns.id))
    .where(eq(aiProposals.id, proposalId))
    .limit(1);
  if (!record)
    throw new ApiError(
      404,
      "proposal_not_found",
      "KI-Vorschlag nicht gefunden.",
    );
  const access = await requireWorkspace(request, record.run.workspaceId);
  if (record.proposal.appliedAt || record.proposal.rejectedAt)
    throw new ApiError(
      409,
      "proposal_resolved",
      "Dieser Vorschlag wurde bereits verarbeitet.",
    );
  const operations = (record.proposal.operations as unknown[])
    .map((item) => aiOperationSchema.parse(item))
    .filter((operation) => operationIds.includes(operation.id));
  if (!operations.length)
    throw new ApiError(
      422,
      "no_operations",
      "Keine gültigen Änderungen ausgewählt.",
    );
  const [policy] = await getDb()
    .select()
    .from(aiPolicies)
    .where(eq(aiPolicies.workspaceId, record.run.workspaceId))
    .limit(1);
  if (!policy)
    throw new ApiError(
      403,
      "ai_disabled",
      "KI ist in diesem Workspace nicht aktiviert.",
    );
  const allowedActions = policy.allowedActions as string[];
  if (
    allowedActions.length &&
    operations.some((operation) => !allowedActions.includes(operation.type))
  )
    throw new ApiError(
      403,
      "ai_action_not_allowed",
      "Mindestens eine ausgewählte KI-Aktion ist durch die Workspace-Richtlinie gesperrt.",
    );
  const allowedProjectIds = new Set(
    (
      await getDb()
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.workspaceId, record.run.workspaceId))
    ).map((item) => item.id),
  );
  const results = await getDb().transaction(async (tx) => {
    const changed: unknown[] = [];
    for (const operation of operations) {
      if (operation.type === "task.update") {
        const [before] = await tx
          .select()
          .from(tasks)
          .where(and(eq(tasks.id, operation.taskId), isNull(tasks.deletedAt)))
          .limit(1);
        if (!before || !allowedProjectIds.has(before.projectId))
          throw new ApiError(
            403,
            "operation_out_of_scope",
            "Eine KI-Änderung liegt außerhalb des Workspaces.",
          );
        const { labelIds, ...taskPatch } = operation.patch;
        if (taskPatch.assigneeId) {
          const [member] = await tx
            .select({ id: memberships.id })
            .from(memberships)
            .where(
              and(
                eq(memberships.workspaceId, record.run.workspaceId),
                eq(memberships.userId, taskPatch.assigneeId),
              ),
            )
            .limit(1);
          if (!member)
            throw new ApiError(
              422,
              "invalid_assignee",
              "Die vorgeschlagene Person gehört nicht zum Workspace.",
            );
        }
        if (labelIds) {
          const validLabels = labelIds.length
            ? await tx
                .select({ id: labels.id })
                .from(labels)
                .where(
                  and(
                    eq(labels.workspaceId, record.run.workspaceId),
                    inArray(labels.id, labelIds),
                  ),
                )
            : [];
          if (validLabels.length !== labelIds.length)
            throw new ApiError(
              422,
              "invalid_labels",
              "Mindestens ein vorgeschlagenes Label gehört nicht zum Workspace.",
            );
        }
        if (taskPatch.milestoneId) {
          const [milestone] = await tx
            .select({ id: milestones.id })
            .from(milestones)
            .where(
              and(
                eq(milestones.id, taskPatch.milestoneId),
                eq(milestones.projectId, before.projectId),
              ),
            )
            .limit(1);
          if (!milestone)
            throw new ApiError(
              422,
              "invalid_milestone",
              "Der vorgeschlagene Meilenstein gehört nicht zum Projekt.",
            );
        }
        const patch = {
          ...taskPatch,
          dueDate:
            taskPatch.dueDate === undefined
              ? undefined
              : taskPatch.dueDate
                ? new Date(`${taskPatch.dueDate}T12:00:00Z`)
                : null,
          completedAt:
            taskPatch.status === "done"
              ? new Date()
              : taskPatch.status
                ? null
                : before.completedAt,
          version: sql`${tasks.version} + 1`,
          updatedAt: new Date(),
        };
        const [after] = await tx
          .update(tasks)
          .set(patch)
          .where(
            and(eq(tasks.id, before.id), eq(tasks.version, before.version)),
          )
          .returning();
        if (!after)
          throw new ApiError(
            409,
            "version_conflict",
            "Die Aufgabe wurde zwischenzeitlich geändert.",
          );
        if (labelIds) {
          await tx.delete(taskLabels).where(eq(taskLabels.taskId, before.id));
          if (labelIds.length)
            await tx
              .insert(taskLabels)
              .values(
                labelIds.map((labelId) => ({ taskId: before.id, labelId })),
              );
        }
        await tx
          .insert(activityEvents)
          .values({
            workspaceId: record.run.workspaceId,
            actorId: access.user.id,
            actorType: "ai",
            entityType: "task",
            entityId: before.id,
            action: "task.updated",
            payload: operation,
            undoPayload: before,
          });
        changed.push(after);
        continue;
      }

      if (operation.type === "milestone.create") {
        if (!allowedProjectIds.has(operation.projectId))
          throw new ApiError(
            403,
            "operation_out_of_scope",
            "Der vorgeschlagene Meilenstein liegt außerhalb des Workspace.",
          );
        const [created] = await tx
          .insert(milestones)
          .values({
            projectId: operation.projectId,
            name: operation.name,
            description: operation.description,
            targetDate: operation.targetDate
              ? new Date(`${operation.targetDate}T12:00:00Z`)
              : null,
            status: "planned",
            createdBy: access.user.id,
          })
          .returning();
        await tx
          .insert(activityEvents)
          .values({
            workspaceId: record.run.workspaceId,
            actorId: access.user.id,
            actorType: "ai",
            entityType: "milestone",
            entityId: created.id,
            action: "milestone.created",
            payload: operation,
            undoPayload: { created: true },
          });
        changed.push(created);
        continue;
      }

      if (operation.type === "dependency.create") {
        if (operation.blockerTaskId === operation.blockedTaskId)
          throw new ApiError(
            422,
            "dependency_cycle",
            "Eine Aufgabe kann sich nicht selbst blockieren.",
          );
        const linked = await tx
          .select({ id: tasks.id, projectId: tasks.projectId })
          .from(tasks)
          .where(
            inArray(tasks.id, [
              operation.blockerTaskId,
              operation.blockedTaskId,
            ]),
          );
        if (
          linked.length !== 2 ||
          linked.some((task) => !allowedProjectIds.has(task.projectId))
        )
          throw new ApiError(
            403,
            "operation_out_of_scope",
            "Die vorgeschlagene Abhängigkeit liegt außerhalb des Workspace.",
          );
        const edges = await tx.select().from(taskDependencies);
        const adjacency = new Map<string, string[]>();
        for (const edge of edges)
          adjacency.set(edge.blockerTaskId, [
            ...(adjacency.get(edge.blockerTaskId) ?? []),
            edge.blockedTaskId,
          ]);
        const stack = [operation.blockedTaskId];
        const seen = new Set<string>();
        while (stack.length) {
          const current = stack.pop()!;
          if (current === operation.blockerTaskId)
            throw new ApiError(
              422,
              "dependency_cycle",
              "Die vorgeschlagene Abhängigkeit würde einen Zyklus erzeugen.",
            );
          if (seen.has(current)) continue;
          seen.add(current);
          stack.push(...(adjacency.get(current) ?? []));
        }
        const [created] = await tx
          .insert(taskDependencies)
          .values({
            blockerTaskId: operation.blockerTaskId,
            blockedTaskId: operation.blockedTaskId,
            createdBy: access.user.id,
          })
          .returning();
        await tx
          .insert(activityEvents)
          .values({
            workspaceId: record.run.workspaceId,
            actorId: access.user.id,
            actorType: "ai",
            entityType: "task_dependency",
            entityId: created.id,
            action: "dependency.created",
            payload: operation,
            undoPayload: { created: true },
          });
        changed.push(created);
        continue;
      }

      const projectId =
        operation.type === "task.create"
          ? operation.projectId
          : (
              await tx
                .select({ projectId: tasks.projectId })
                .from(tasks)
                .where(
                  and(eq(tasks.id, operation.taskId), isNull(tasks.deletedAt)),
                )
                .limit(1)
            )[0]?.projectId;
      if (!projectId || !allowedProjectIds.has(projectId))
        throw new ApiError(
          403,
          "operation_out_of_scope",
          "Eine KI-Änderung liegt außerhalb des Workspaces.",
        );

      const [counter] = await tx
        .update(workspaces)
        .set({
          nextTaskNumber: sql`${workspaces.nextTaskNumber} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(workspaces.id, record.run.workspaceId))
        .returning({ nextTaskNumber: workspaces.nextTaskNumber });
      const [created] = await tx
        .insert(tasks)
        .values({
          projectId,
          parentId:
            operation.type === "subtask.create" ? operation.taskId : null,
          number: counter.nextTaskNumber - 1,
          title: operation.title,
          description:
            operation.type === "task.create" ? operation.description : "",
          createdBy: access.user.id,
        })
        .returning();
      await tx
        .insert(activityEvents)
        .values({
          workspaceId: record.run.workspaceId,
          actorId: access.user.id,
          actorType: "ai",
          entityType: "task",
          entityId: created.id,
          action: "task.created",
          payload: operation,
          undoPayload: { created: true },
        });
      changed.push(created);
    }
    await tx
      .update(aiProposals)
      .set({
        selectedOperationIds: operationIds,
        appliedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(aiProposals.id, proposalId));
    await tx
      .update(aiRuns)
      .set({ status: "applied", updatedAt: new Date() })
      .where(eq(aiRuns.id, record.run.id));
    return changed;
  });
  return { proposalId, applied: results };
}

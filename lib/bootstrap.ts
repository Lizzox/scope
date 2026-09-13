import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { comments, labels, memberships, milestones, notifications, projects, savedViews, taskDependencies, taskLabels, tasks, users, workspaces } from "@/lib/db/schema";
import { ensureInstance } from "@/lib/setup";

export async function getBootstrap(request: NextRequest) {
  const instance = await ensureInstance();
  if (!instance?.setupComplete) return { setupComplete: false, authenticated: false };
  const user = await getSessionUser(request);
  if (!user) return { setupComplete: true, authenticated: false };
  const memberRows = await getDb().select({ workspace: workspaces, role: memberships.role }).from(memberships).innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id)).where(eq(memberships.userId, user.id)).orderBy(asc(workspaces.createdAt));
  const workspaceId = request.nextUrl.searchParams.get("workspaceId") ?? memberRows[0]?.workspace.id;
  const current = memberRows.find((item) => item.workspace.id === workspaceId) ?? memberRows[0];
  if (!current) return { setupComplete: true, authenticated: true, user, workspaces: [], projects: [], tasks: [] };
  const projectRows = await getDb().select().from(projects).where(eq(projects.workspaceId, current.workspace.id)).orderBy(asc(projects.createdAt));
  const projectIds = projectRows.map((project) => project.id);
  const taskRows = projectIds.length ? await getDb().select({ task: tasks, assigneeName: users.name }).from(tasks).leftJoin(users, eq(tasks.assigneeId, users.id)).where(and(inArray(tasks.projectId, projectIds), isNull(tasks.deletedAt))).orderBy(asc(tasks.position)) : [];
  const taskIds = taskRows.map(({ task }) => task.id);
  const [labelRows, commentRows, milestoneRows, dependencyRows, viewRows, unreadRows] = await Promise.all([
    taskIds.length ? getDb().select({ taskId: taskLabels.taskId, labelId: labels.id, name: labels.name, color: labels.color }).from(taskLabels).innerJoin(labels, eq(labels.id, taskLabels.labelId)).where(inArray(taskLabels.taskId, taskIds)) : Promise.resolve([]),
    taskIds.length ? getDb().select({ taskId: comments.taskId, count: sql<number>`count(*)` }).from(comments).where(inArray(comments.taskId, taskIds)).groupBy(comments.taskId) : Promise.resolve([]),
    projectIds.length ? getDb().select().from(milestones).where(inArray(milestones.projectId, projectIds)).orderBy(asc(milestones.position)) : Promise.resolve([]),
    taskIds.length ? getDb().select().from(taskDependencies).where(inArray(taskDependencies.blockedTaskId, taskIds)) : Promise.resolve([]),
    getDb().select().from(savedViews).where(and(eq(savedViews.workspaceId, current.workspace.id), sql`(${savedViews.ownerId} = ${user.id} or ${savedViews.scope} <> 'personal')`)).orderBy(asc(savedViews.name)),
    getDb().select({ count: sql<number>`count(*)` }).from(notifications).where(and(eq(notifications.workspaceId, current.workspace.id), eq(notifications.userId, user.id), isNull(notifications.readAt))),
  ]);
  const topLevelTasks = taskRows.filter(({ task }) => !task.parentId);
  return {
    setupComplete: true, authenticated: true,
    user: { id: user.id, name: user.name, email: user.email, locale: user.locale, appearance: user.appearance, themePreferences: user.themePreferences, preferredAutonomy: user.preferredAutonomy },
    workspaces: memberRows.map((item) => ({ ...item.workspace, role: item.role })), currentWorkspace: { ...current.workspace, role: current.role }, projects: projectRows,
    milestones: milestoneRows.map((milestone) => ({ ...milestone, targetDate: milestone.targetDate?.toISOString().slice(0, 10) ?? "" })), dependencies: dependencyRows, savedViews: viewRows, unreadNotifications: Number(unreadRows[0]?.count ?? 0),
    tasks: topLevelTasks.map(({ task, assigneeName }) => ({ ...task, key: `${projectRows.find((project) => project.id === task.projectId)?.key ?? "SCO"}-${task.number}`, dueDate: task.dueDate?.toISOString().slice(0, 10) ?? "", assignee: initials(assigneeName), labels: labelRows.filter((label) => label.taskId === task.id).map((label) => label.name), labelIds: labelRows.filter((label) => label.taskId === task.id).map((label) => label.labelId), blockedBy: dependencyRows.filter((edge) => edge.blockedTaskId === task.id).map((edge) => edge.blockerTaskId), blocking: dependencyRows.filter((edge) => edge.blockerTaskId === task.id).map((edge) => edge.blockedTaskId), subtasks: taskRows.filter(({ task: child }) => child.parentId === task.id).map(({ task: child }) => ({ id: child.id, title: child.title, done: child.status === "done" })), comments: Number(commentRows.find((row) => row.taskId === task.id)?.count ?? 0) })),
  };
}

function initials(name: string | null) { return name?.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "–"; }

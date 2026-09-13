import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { milestones, memberships, projects, taskDependencies, tasks, users } from "@/lib/db/schema";
import { apiError, ok } from "@/lib/http/api";
import { uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const workspaceId = uuidSchema.parse(request.nextUrl.searchParams.get("workspaceId"));
    await requireWorkspace(request, workspaceId);
    const requestedProjectId = request.nextUrl.searchParams.get("projectId");
    const projectRows = await getDb().select().from(projects).where(eq(projects.workspaceId, workspaceId)).orderBy(asc(projects.createdAt));
    const scopedProjects = requestedProjectId ? projectRows.filter((project) => project.id === requestedProjectId) : projectRows;
    const projectIds = scopedProjects.map((project) => project.id);
    const [taskRows, milestoneRows, memberRows] = await Promise.all([
      projectIds.length ? getDb().select().from(tasks).where(and(inArray(tasks.projectId, projectIds), isNull(tasks.deletedAt))) : Promise.resolve([]),
      projectIds.length ? getDb().select().from(milestones).where(inArray(milestones.projectId, projectIds)) : Promise.resolve([]),
      getDb().select({ id: users.id, name: users.name, role: memberships.role }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(eq(memberships.workspaceId, workspaceId)),
    ]);
    const taskIds = taskRows.map((task) => task.id);
    const dependencies = taskIds.length ? await getDb().select().from(taskDependencies).where(inArray(taskDependencies.blockedTaskId, taskIds)) : [];
    const openBlockerIds = new Set(taskRows.filter((task) => task.status !== "done").map((task) => task.id));
    const blockedIds = new Set(dependencies.filter((dependency) => openBlockerIds.has(dependency.blockerTaskId)).map((dependency) => dependency.blockedTaskId));
    const now = new Date(); const soon = new Date(now.getTime() + 7 * 86400000);
    const open = taskRows.filter((task) => task.status !== "done"); const done = taskRows.length - open.length;
    const overdue = open.filter((task) => task.dueDate && task.dueDate < now).length;
    const upcoming = open.filter((task) => task.dueDate && task.dueDate >= now && task.dueDate <= soon).length;
    const unassigned = open.filter((task) => !task.assigneeId).length;
    const workload = memberRows.map((member) => ({ ...member, openTasks: open.filter((task) => task.assigneeId === member.id).length, urgentTasks: open.filter((task) => task.assigneeId === member.id && task.priority === "urgent").length }));
    const milestoneProgress = milestoneRows.map((milestone) => { const related = taskRows.filter((task) => task.milestoneId === milestone.id); const completed = related.filter((task) => task.status === "done").length; return { ...milestone, totalTasks: related.length, completedTasks: completed, progress: related.length ? Math.round(completed / related.length * 100) : 0 }; });
    const healthIssues = [overdue && { type: "overdue", severity: overdue > 5 ? "high" : "medium", count: overdue, title: `${overdue} überfällige Aufgaben` }, blockedIds.size && { type: "blocked", severity: "high", count: blockedIds.size, title: `${blockedIds.size} blockierte Aufgaben` }, unassigned && { type: "unassigned", severity: "low", count: unassigned, title: `${unassigned} Aufgaben ohne Verantwortliche` }].filter(Boolean);
    return ok({ summary: { projects: scopedProjects.length, tasks: taskRows.length, open: open.length, done, overdue, upcoming, blocked: blockedIds.size, unassigned, progress: taskRows.length ? Math.round(done / taskRows.length * 100) : 0 }, projects: scopedProjects.map((project) => { const projectTasks = taskRows.filter((task) => task.projectId === project.id); return { ...project, totalTasks: projectTasks.length, completedTasks: projectTasks.filter((task) => task.status === "done").length, blockedTasks: projectTasks.filter((task) => blockedIds.has(task.id)).length }; }), milestones: milestoneProgress, workload, healthIssues });
  } catch (error) { return apiError(error); }
}

import "server-only";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { projects, tasks } from "@/lib/db/schema";
import { ApiError } from "@/lib/http/errors";
import { requireWorkspace, type WorkspaceRole } from "./access";

export async function requireProject(request: NextRequest, projectId: string, roles?: WorkspaceRole[]) {
  const [project] = await getDb().select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) throw new ApiError(404, "project_not_found", "Projekt nicht gefunden.");
  const access = await requireWorkspace(request, project.workspaceId, roles);
  return { project, ...access };
}

export async function requireTask(request: NextRequest, taskId: string, roles?: WorkspaceRole[]) {
  const [record] = await getDb().select({ task: tasks, project: projects }).from(tasks).innerJoin(projects, eq(tasks.projectId, projects.id)).where(eq(tasks.id, taskId)).limit(1);
  if (!record || record.task.deletedAt) throw new ApiError(404, "task_not_found", "Aufgabe nicht gefunden.");
  const access = await requireWorkspace(request, record.project.workspaceId, roles);
  return { ...record, ...access };
}

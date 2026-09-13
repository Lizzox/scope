import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { projects, savedViews } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";
import { savedViewUpdateSchema } from "@/lib/validation";

type Context = { params: Promise<{ viewId: string }> };
async function access(request: NextRequest, viewId: string) {
  const [view] = await getDb()
    .select()
    .from(savedViews)
    .where(eq(savedViews.id, viewId))
    .limit(1);
  if (!view)
    throw new ApiError(404, "view_not_found", "Ansicht nicht gefunden.");
  const auth = await requireWorkspace(request, view.workspaceId);
  if (
    view.ownerId !== auth.user.id &&
    !["owner", "admin"].includes(auth.membership.role)
  )
    throw new ApiError(
      403,
      "view_forbidden",
      "Diese Ansicht darf nicht geändert werden.",
    );
  return { view, ...auth };
}
export async function PATCH(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const { viewId } = await context.params;
    const current = await access(request, viewId);
    const input = await parseJson(request, savedViewUpdateSchema);
    if (
      input.scope === "workspace" &&
      !["owner", "admin"].includes(current.membership.role)
    )
      throw new ApiError(
        403,
        "role_required",
        "Workspace-Ansichten können nur Owner und Admins verwalten.",
      );
    if (input.projectId) {
      const [project] = await getDb()
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projects.workspaceId, current.view.workspaceId),
          ),
        )
        .limit(1);
      if (!project)
        throw new ApiError(
          422,
          "invalid_project",
          "Das Projekt gehört nicht zu diesem Workspace.",
        );
    }
    const [view] = await getDb()
      .update(savedViews)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(savedViews.id, viewId))
      .returning();
    return ok(view);
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const { viewId } = await context.params;
    await access(request, viewId);
    const [view] = await getDb()
      .delete(savedViews)
      .where(eq(savedViews.id, viewId))
      .returning();
    return ok(view);
  } catch (error) {
    return apiError(error);
  }
}

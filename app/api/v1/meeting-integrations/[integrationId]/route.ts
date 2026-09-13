import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { meetingIntegrations } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";

type Context = { params: Promise<{ integrationId: string }> };

export async function DELETE(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const workspaceId = request.nextUrl.searchParams.get("workspaceId");
    if (!workspaceId)
      throw new ApiError(400, "workspace_required", "workspaceId fehlt.");
    await requireWorkspace(request, workspaceId, ["owner", "admin"]);
    const { integrationId } = await context.params;
    const [removed] = await getDb()
      .delete(meetingIntegrations)
      .where(
        and(
          eq(meetingIntegrations.id, integrationId),
          eq(meetingIntegrations.workspaceId, workspaceId),
        ),
      )
      .returning({ id: meetingIntegrations.id });
    if (!removed)
      throw new ApiError(
        404,
        "meeting_integration_not_found",
        "Meeting-Integration nicht gefunden.",
      );
    return ok(removed);
  } catch (error) {
    return apiError(error);
  }
}

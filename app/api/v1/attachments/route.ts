import { and, desc, eq, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { requireProject, requireTask } from "@/lib/auth/resources";
import { getDb } from "@/lib/db/client";
import { attachments, instanceSettings, meetings } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";
import { storeFile } from "@/lib/storage";
import { uuidSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const blockedTypes = new Set([
  "text/html",
  "image/svg+xml",
  "application/javascript",
  "text/javascript",
  "application/x-sh",
  "application/x-msdownload",
]);

async function authorizeEntity(
  request: NextRequest,
  workspaceId: string,
  entityType: string,
  entityId: string,
) {
  const workspace = await requireWorkspace(request, workspaceId);
  if (entityType === "task") {
    const access = await requireTask(request, entityId);
    if (access.project.workspaceId !== workspaceId)
      throw new ApiError(
        403,
        "entity_out_of_scope",
        "Ziel liegt außerhalb des Workspace.",
      );
  } else if (entityType === "project") {
    const access = await requireProject(request, entityId);
    if (access.project.workspaceId !== workspaceId)
      throw new ApiError(
        403,
        "entity_out_of_scope",
        "Ziel liegt außerhalb des Workspace.",
      );
  } else if (entityType === "meeting") {
    const [meeting] = await getDb()
      .select({ id: meetings.id })
      .from(meetings)
      .where(
        and(eq(meetings.id, entityId), eq(meetings.workspaceId, workspaceId)),
      )
      .limit(1);
    if (!meeting)
      throw new ApiError(404, "meeting_not_found", "Meeting nicht gefunden.");
  } else
    throw new ApiError(
      422,
      "invalid_attachment_target",
      "Anhänge werden für Projekte, Aufgaben und Meetings unterstützt.",
    );
  return workspace;
}

export async function GET(request: NextRequest) {
  try {
    const workspaceId = uuidSchema.parse(
      request.nextUrl.searchParams.get("workspaceId"),
    );
    const entityId = uuidSchema.parse(
      request.nextUrl.searchParams.get("entityId"),
    );
    const entityType = request.nextUrl.searchParams.get("entityType") || "task";
    await authorizeEntity(request, workspaceId, entityType, entityId);
    return ok(
      await getDb()
        .select()
        .from(attachments)
        .where(
          and(
            eq(attachments.workspaceId, workspaceId),
            eq(attachments.entityType, entityType),
            eq(attachments.entityId, entityId),
            isNull(attachments.deletedAt),
          ),
        )
        .orderBy(desc(attachments.createdAt)),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const transportLimit = Math.max(
      1_048_576,
      Number(process.env.SCOPE_MAX_UPLOAD_BYTES || 262_144_000),
    );
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength && contentLength > transportLimit + 1_048_576)
      throw new ApiError(
        413,
        "request_too_large",
        `Der Upload darf maximal ${Math.round(transportLimit / 1048576)} MB groß sein.`,
      );
    assertSameOrigin(request);
    const form = await request.formData();
    const workspaceId = uuidSchema.parse(form.get("workspaceId"));
    const entityType = String(form.get("entityType") || "task");
    const entityId = uuidSchema.parse(form.get("entityId"));
    const projectIdValue = form.get("projectId");
    const projectId = projectIdValue ? uuidSchema.parse(projectIdValue) : null;
    const access = await authorizeEntity(
      request,
      workspaceId,
      entityType,
      entityId,
    );
    const file = form.get("file");
    if (!(file instanceof File))
      throw new ApiError(422, "file_required", "Bitte eine Datei auswählen.");
    const [settings] = await getDb().select().from(instanceSettings).limit(1);
    const normalLimit = Math.min(
      settings?.maxAttachmentBytes ?? 104_857_600,
      transportLimit,
    );
    const limit =
      entityType === "meeting"
        ? Math.min(Math.max(normalLimit, 262_144_000), transportLimit)
        : normalLimit;
    if (!file.size || file.size > limit)
      throw new ApiError(
        413,
        "file_too_large",
        `Die Datei darf maximal ${Math.round(limit / 1048576)} MB groß sein.`,
      );
    if (blockedTypes.has(file.type))
      throw new ApiError(
        415,
        "unsafe_file_type",
        "Dieser Dateityp kann aus Sicherheitsgründen nicht gespeichert werden.",
      );
    const data = new Uint8Array(await file.arrayBuffer());
    const stored = await storeFile(data);
    const [attachment] = await getDb()
      .insert(attachments)
      .values({
        workspaceId,
        projectId,
        entityType,
        entityId,
        uploadedBy: access.user.id,
        storageProvider: stored.storageProvider,
        objectKey: stored.objectKey,
        originalName: file.name.slice(0, 240),
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        sha256: stored.sha256,
        status: "ready",
        aiAllowed: form.get("aiAllowed") === "true",
      })
      .returning();
    return ok(attachment, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

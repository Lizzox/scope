import { and, eq, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { attachments } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";
import { deleteStoredFile, readStoredFile } from "@/lib/storage";
import { safeDownloadName } from "@/lib/storage/local";

export const runtime = "nodejs";
type Context = { params: Promise<{ attachmentId: string }> };
async function access(request: NextRequest, attachmentId: string) { const [attachment] = await getDb().select().from(attachments).where(and(eq(attachments.id, attachmentId), isNull(attachments.deletedAt))).limit(1); if (!attachment) throw new ApiError(404, "attachment_not_found", "Anhang nicht gefunden."); const auth = await requireWorkspace(request, attachment.workspaceId); return { attachment, ...auth }; }
export async function GET(request: NextRequest, context: Context) { try { const { attachmentId } = await context.params; const { attachment } = await access(request, attachmentId); const data = await readStoredFile(attachment.storageProvider, attachment.objectKey); return new Response(data, { headers: { "content-type": attachment.mimeType, "content-length": String(data.length), "content-disposition": `attachment; filename="${safeDownloadName(attachment.originalName)}"`, "cache-control": "private, max-age=60", "x-content-type-options": "nosniff" } }); } catch (error) { return apiError(error); } }
export async function DELETE(request: NextRequest, context: Context) { try { assertSameOrigin(request); const { attachmentId } = await context.params; const { attachment } = await access(request, attachmentId); await deleteStoredFile(attachment.storageProvider, attachment.objectKey); const [removed] = await getDb().update(attachments).set({ status: "deleted", deletedAt: new Date(), updatedAt: new Date() }).where(eq(attachments.id, attachmentId)).returning(); return ok(removed); } catch (error) { return apiError(error); } }

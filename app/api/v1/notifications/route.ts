import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { notificationUpdateSchema, uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) { try { const workspaceId = uuidSchema.parse(request.nextUrl.searchParams.get("workspaceId")); const access = await requireWorkspace(request, workspaceId); const rows = await getDb().select().from(notifications).where(and(eq(notifications.workspaceId, workspaceId), eq(notifications.userId, access.user.id))).orderBy(desc(notifications.createdAt)).limit(100); return ok({ notifications: rows, unread: rows.filter((row) => !row.readAt).length }); } catch (error) { return apiError(error); } }
export async function PATCH(request: NextRequest) { try { assertSameOrigin(request); const workspaceId = uuidSchema.parse(request.nextUrl.searchParams.get("workspaceId")); const access = await requireWorkspace(request, workspaceId); const input = await parseJson(request, notificationUpdateSchema); const condition = input.all ? and(eq(notifications.workspaceId, workspaceId), eq(notifications.userId, access.user.id), input.read ? isNull(notifications.readAt) : undefined) : and(eq(notifications.workspaceId, workspaceId), eq(notifications.userId, access.user.id), inArray(notifications.id, input.ids!)); const rows = await getDb().update(notifications).set({ readAt: input.read ? new Date() : null }).where(condition).returning(); return ok(rows); } catch (error) { return apiError(error); } }

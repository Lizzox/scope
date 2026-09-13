import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { notificationPreferences } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { notificationPreferencesSchema, uuidSchema } from "@/lib/validation";

export async function GET(request: NextRequest) { try { const workspaceId = uuidSchema.parse(request.nextUrl.searchParams.get("workspaceId")); const access = await requireWorkspace(request, workspaceId); const [preferences] = await getDb().select().from(notificationPreferences).where(and(eq(notificationPreferences.workspaceId, workspaceId), eq(notificationPreferences.userId, access.user.id))).limit(1); return ok(preferences ?? { workspaceId, userId: access.user.id, channels: { inApp: true, email: false, push: false }, digest: "instant", quietHours: {} }); } catch (error) { return apiError(error); } }
export async function PUT(request: NextRequest) { try { assertSameOrigin(request); const input = await parseJson(request, notificationPreferencesSchema); const access = await requireWorkspace(request, input.workspaceId); const [preferences] = await getDb().insert(notificationPreferences).values({ ...input, userId: access.user.id }).onConflictDoUpdate({ target: [notificationPreferences.workspaceId, notificationPreferences.userId], set: { channels: input.channels, digest: input.digest, quietHours: input.quietHours, updatedAt: new Date() } }).returning(); return ok(preferences); } catch (error) { return apiError(error); } }

import { and, desc, eq, lt } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { activityEvents } from "@/lib/db/schema";
import { apiError, ok } from "@/lib/http/api";
import { uuidSchema } from "@/lib/validation";

export async function GET(request: NextRequest) { try { const workspaceId = uuidSchema.parse(request.nextUrl.searchParams.get("workspaceId")); await requireWorkspace(request, workspaceId); const before = request.nextUrl.searchParams.get("before"); const query = before ? and(eq(activityEvents.workspaceId, workspaceId), lt(activityEvents.createdAt, new Date(before))) : eq(activityEvents.workspaceId, workspaceId); const rows = await getDb().select().from(activityEvents).where(query).orderBy(desc(activityEvents.createdAt)).limit(100); return ok(rows); } catch (error) { return apiError(error); } }

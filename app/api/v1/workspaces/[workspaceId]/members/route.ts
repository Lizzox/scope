import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { memberships, users } from "@/lib/db/schema";
import { apiError, ok } from "@/lib/http/api";

type Context = { params: Promise<{ workspaceId: string }> };
export async function GET(request: NextRequest, context: Context) { try { const { workspaceId } = await context.params; await requireWorkspace(request, workspaceId); const rows = await getDb().select({ id: memberships.id, role: memberships.role, userId: users.id, name: users.name, email: users.email, createdAt: memberships.createdAt }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(eq(memberships.workspaceId, workspaceId)); return ok(rows); } catch (error) { return apiError(error); } }

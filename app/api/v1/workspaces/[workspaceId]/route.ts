import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { workspaces } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { workspaceUpdateSchema } from "@/lib/validation";

type Context = { params: Promise<{ workspaceId: string }> };
export async function PATCH(request: NextRequest, context: Context) { try { assertSameOrigin(request); const { workspaceId } = await context.params; await requireWorkspace(request, workspaceId, ["owner", "admin"]); const input = await parseJson(request, workspaceUpdateSchema); const [workspace] = await getDb().update(workspaces).set({ name: input.name, updatedAt: new Date() }).where(eq(workspaces.id, workspaceId)).returning(); return ok(workspace); } catch (error) { return apiError(error); } }

import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { aiProviderConfigs } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";

type Context = { params: Promise<{ providerId: string }> };
export async function DELETE(request: NextRequest, context: Context) { try { assertSameOrigin(request); const workspaceId = request.nextUrl.searchParams.get("workspaceId"); if (!workspaceId) throw new ApiError(400, "workspace_required", "workspaceId fehlt."); await requireWorkspace(request, workspaceId, ["owner", "admin"]); const { providerId } = await context.params; const [config] = await getDb().update(aiProviderConfigs).set({ enabled: false, encryptedSecret: null, updatedAt: new Date() }).where(and(eq(aiProviderConfigs.id, providerId), eq(aiProviderConfigs.workspaceId, workspaceId))).returning({ id: aiProviderConfigs.id }); if (!config) throw new ApiError(404, "provider_not_found", "KI-Provider nicht gefunden."); return ok(config); } catch (error) { return apiError(error); } }

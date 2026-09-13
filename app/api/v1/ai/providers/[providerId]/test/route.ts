import type { NextRequest } from "next/server";
import { adapterFor, requireProvider } from "@/lib/ai/config";
import { getDb } from "@/lib/db/client";
import { aiProviderConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiError, assertSameOrigin, ok } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";

type Context = { params: Promise<{ providerId: string }> };
export async function POST(request: NextRequest, context: Context) { try { assertSameOrigin(request); const workspaceId = request.nextUrl.searchParams.get("workspaceId"); if (!workspaceId) throw new ApiError(400, "workspace_required", "workspaceId fehlt."); const { providerId } = await context.params; const { config } = await requireProvider(request, workspaceId, providerId, true); const result = await adapterFor(config).testConnection(); const modelIds = result.models?.map((model) => model.id) ?? []; await getDb().update(aiProviderConfigs).set({ models: modelIds, updatedAt: new Date() }).where(eq(aiProviderConfigs.id, providerId)); return ok(result); } catch (error) { return apiError(error); } }

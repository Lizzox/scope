import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { adapterFor, requireProvider } from "@/lib/ai/config";
import { getDb } from "@/lib/db/client";
import { aiProviderConfigs } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";

type Context = { params: Promise<{ providerId: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const workspaceId = request.nextUrl.searchParams.get("workspaceId");
    if (!workspaceId) throw new ApiError(400, "workspace_required", "workspaceId fehlt.");
    const { providerId } = await context.params;
    const { config } = await requireProvider(request, workspaceId, providerId, true);
    const models = await adapterFor(config).listModels();
    await getDb().update(aiProviderConfigs).set({ models: models.map((model) => model.id), updatedAt: new Date() }).where(eq(aiProviderConfigs.id, providerId));
    return ok(models);
  } catch (error) { return apiError(error); }
}

import { asc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { adapterFor, publicProvider } from "@/lib/ai/config";
import { recordActivity } from "@/lib/activity";
import { getDb } from "@/lib/db/client";
import { aiProviderConfigs } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { encryptSecret } from "@/lib/security/secrets";
import { providerCreateSchema, uuidSchema } from "@/lib/validation";

export async function GET(request: NextRequest) { try { const workspaceId = uuidSchema.parse(request.nextUrl.searchParams.get("workspaceId")); await requireWorkspace(request, workspaceId); const configs = await getDb().select().from(aiProviderConfigs).where(eq(aiProviderConfigs.workspaceId, workspaceId)).orderBy(asc(aiProviderConfigs.createdAt)); return ok(configs.map(publicProvider)); } catch (error) { return apiError(error); } }
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const input = await parseJson(request, providerCreateSchema);
    const access = await requireWorkspace(request, input.workspaceId, ["owner", "admin"]);
    let [config] = await getDb().insert(aiProviderConfigs).values({ workspaceId: input.workspaceId, provider: input.provider, name: input.name, endpoint: input.endpoint, encryptedSecret: input.apiKey ? encryptSecret(input.apiKey) : null, models: input.models }).returning();
    try {
      const models = await adapterFor(config).listModels();
      [config] = await getDb().update(aiProviderConfigs).set({ models: models.map((model) => model.id), updatedAt: new Date() }).where(eq(aiProviderConfigs.id, config.id)).returning();
    } catch { /* The provider may be temporarily offline; it can be refreshed later. */ }
    await recordActivity({ workspaceId: input.workspaceId, actorId: access.user.id, entityType: "ai_provider", entityId: config.id, action: "ai_provider.created", payload: { provider: input.provider, name: input.name } });
    return ok(publicProvider(config), { status: 201 });
  } catch (error) { return apiError(error); }
}

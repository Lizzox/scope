import "server-only";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { createProviderAdapter, type ProviderConfig } from "./provider";
import { getDb } from "@/lib/db/client";
import { aiProviderConfigs } from "@/lib/db/schema";
import { ApiError } from "@/lib/http/errors";
import { decryptSecret } from "@/lib/security/secrets";

export async function requireProvider(request: NextRequest, workspaceId: string, providerId: string, admin = false) {
  const access = await requireWorkspace(request, workspaceId, admin ? ["owner", "admin"] : undefined);
  const [config] = await getDb().select().from(aiProviderConfigs).where(and(eq(aiProviderConfigs.id, providerId), eq(aiProviderConfigs.workspaceId, workspaceId), eq(aiProviderConfigs.enabled, true))).limit(1);
  if (!config) throw new ApiError(404, "provider_not_found", "KI-Provider nicht gefunden.");
  return { config, ...access };
}

export function adapterFor(config: typeof aiProviderConfigs.$inferSelect) {
  const apiKey = config.encryptedSecret ? decryptSecret(config.encryptedSecret) : undefined;
  return createProviderAdapter({ provider: config.provider as ProviderConfig["provider"], apiKey, endpoint: config.endpoint ?? undefined } as ProviderConfig);
}

export function publicProvider(config: typeof aiProviderConfigs.$inferSelect) {
  return { id: config.id, workspaceId: config.workspaceId, provider: config.provider, name: config.name, endpoint: config.endpoint, models: config.models, enabled: config.enabled, hasSecret: Boolean(config.encryptedSecret), createdAt: config.createdAt, updatedAt: config.updatedAt };
}

import "server-only";
import { decryptSecret } from "@/lib/security/secrets";

type IntegrationRow = {
  id: string;
  provider: string;
  name: string;
  enabled: boolean;
  projectId: string | null;
  config: unknown;
  encryptedCredentials: string;
  lastConnectedAt: Date | null;
  lastError: string | null;
};

export function publicMeetingIntegration(row: IntegrationRow) {
  const config = (row.config ?? {}) as Record<string, unknown>;
  const applicationId =
    typeof config.applicationId === "string" ? config.applicationId : null;
  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    enabled: row.enabled,
    projectId: row.projectId,
    config,
    hasCredentials: Boolean(row.encryptedCredentials),
    lastConnectedAt: row.lastConnectedAt,
    lastError: row.lastError,
    inviteUrl:
      row.provider === "discord" && applicationId
        ? `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(applicationId)}&scope=bot%20applications.commands&permissions=1051648`
        : null,
  };
}

export function integrationCredentials<T>(row: {
  encryptedCredentials: string;
}) {
  return JSON.parse(decryptSecret(row.encryptedCredentials)) as T;
}

export async function getTeamsToken(credentials: {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}) {
  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const response = await fetch(
    `https://login.microsoftonline.com/${credentials.tenantId}/oauth2/v2.0/token`,
    { method: "POST", body, cache: "no-store" },
  );
  const payload = (await response.json()) as {
    access_token?: string;
    error_description?: string;
  };
  if (!response.ok || !payload.access_token)
    throw new Error(
      payload.error_description ?? `teams_auth_${response.status}`,
    );
  return payload.access_token;
}

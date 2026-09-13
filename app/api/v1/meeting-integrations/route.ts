import { asc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { meetingIntegrations } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";
import {
  getTeamsToken,
  publicMeetingIntegration,
} from "@/lib/meeting-integrations";
import { encryptSecret } from "@/lib/security/secrets";
import { meetingIntegrationCreateSchema, uuidSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const workspaceId = uuidSchema.parse(
      request.nextUrl.searchParams.get("workspaceId"),
    );
    await requireWorkspace(request, workspaceId, ["owner", "admin"]);
    const rows = await getDb()
      .select()
      .from(meetingIntegrations)
      .where(eq(meetingIntegrations.workspaceId, workspaceId))
      .orderBy(asc(meetingIntegrations.createdAt));
    return ok(rows.map(publicMeetingIntegration));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const input = await parseJson(request, meetingIntegrationCreateSchema);
    const access = await requireWorkspace(request, input.workspaceId, [
      "owner",
      "admin",
    ]);
    let config: Record<string, string>;
    let credentials: Record<string, string>;
    if (input.provider === "discord") {
      const response = await fetch("https://discord.com/api/v10/users/@me", {
        headers: { authorization: `Bot ${input.botToken}` },
        cache: "no-store",
      });
      const profile = (await response.json()) as {
        id?: string;
        message?: string;
      };
      if (!response.ok || profile.id !== input.applicationId)
        throw new ApiError(
          422,
          "discord_credentials_invalid",
          profile.message ??
            "Discord Application ID oder Bot Token ist ungültig.",
        );
      config = { applicationId: input.applicationId };
      credentials = { botToken: input.botToken };
    } else {
      try {
        await getTeamsToken(input);
      } catch {
        throw new ApiError(
          422,
          "teams_credentials_invalid",
          "Microsoft Tenant, Client ID oder Client Secret konnte nicht bestätigt werden.",
        );
      }
      config = {
        tenantId: input.tenantId,
        clientId: input.clientId,
        organizerUserId: input.organizerUserId,
      };
      credentials = { clientSecret: input.clientSecret };
    }
    const [row] = await getDb()
      .insert(meetingIntegrations)
      .values({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        provider: input.provider,
        name: input.name,
        config,
        encryptedCredentials: encryptSecret(JSON.stringify(credentials)),
        lastConnectedAt: new Date(),
        createdBy: access.user.id,
      })
      .onConflictDoUpdate({
        target: [meetingIntegrations.workspaceId, meetingIntegrations.provider],
        set: {
          projectId: input.projectId,
          name: input.name,
          config,
          encryptedCredentials: encryptSecret(JSON.stringify(credentials)),
          enabled: true,
          lastConnectedAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return ok(publicMeetingIntegration(row), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

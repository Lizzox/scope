import { desc, eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { attachments, instanceSettings, jobs } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { adminSettingsSchema, uuidSchema } from "@/lib/validation";

async function owner(request: NextRequest) {
  const workspaceId = uuidSchema.parse(
    request.nextUrl.searchParams.get("workspaceId"),
  );
  return {
    workspaceId,
    ...(await requireWorkspace(request, workspaceId, ["owner"])),
  };
}
async function settings() {
  const [current] = await getDb().select().from(instanceSettings).limit(1);
  if (current) return current;
  const [created] = await getDb()
    .insert(instanceSettings)
    .values({})
    .returning();
  return created;
}
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    await owner(request);
    const [current, jobCounts, storage, failed] = await Promise.all([
      settings(),
      getDb()
        .select({ status: jobs.status, count: sql<number>`count(*)` })
        .from(jobs)
        .groupBy(jobs.status),
      getDb()
        .select({
          bytes: sql<number>`coalesce(sum(${attachments.sizeBytes}),0)`,
        })
        .from(attachments)
        .where(eq(attachments.status, "ready")),
      getDb()
        .select({
          id: jobs.id,
          type: jobs.type,
          error: jobs.lastError,
          createdAt: jobs.createdAt,
        })
        .from(jobs)
        .where(eq(jobs.status, "failed"))
        .orderBy(desc(jobs.createdAt))
        .limit(10),
    ]);
    return ok({
      version: process.env.SCOPE_VERSION ?? "0.2.0",
      database: "connected",
      worker: { jobs: jobCounts, failed },
      storage: {
        provider: current.storageProvider,
        bytes: Number(storage[0]?.bytes ?? 0),
        maxAttachmentBytes: current.maxAttachmentBytes,
      },
      services: {
        smtpConfigured: Boolean(process.env.SCOPE_SMTP_HOST),
        pushConfigured: Boolean(
          process.env.SCOPE_VAPID_PUBLIC_KEY &&
          process.env.SCOPE_VAPID_PRIVATE_KEY,
        ),
        transcriberConfigured: Boolean(process.env.SCOPE_TRANSCRIBER_URL),
      },
      updateChecksEnabled: current.updateChecksEnabled,
      backup: {
        databaseCommand:
          "docker compose exec -T postgres pg_dump -U scope -d scope > scope-backup.sql",
        filesCommand:
          "docker compose run --rm app tar -czf - /data/uploads > scope-files.tar.gz",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await owner(request);
    const input = await parseJson(request, adminSettingsSchema);
    const current = await settings();
    const [updated] = await getDb()
      .update(instanceSettings)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(instanceSettings.id, current.id))
      .returning();
    return ok(updated);
  } catch (error) {
    return apiError(error);
  }
}

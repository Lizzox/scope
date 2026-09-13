import "server-only";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  aiPolicies,
  aiProviderConfigs,
  instanceSetup,
  memberships,
  projects,
  tasks,
  users,
  workspaces,
} from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { ApiError } from "@/lib/http/errors";
import { encryptSecret } from "@/lib/security/secrets";
import type { z } from "zod";
import type { setupSchema } from "@/lib/validation";

export const INSTANCE_ID = "00000000-0000-4000-8000-000000000001";
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export async function ensureInstance() {
  const envToken = process.env.SCOPE_SETUP_TOKEN;
  await getDb()
    .insert(instanceSetup)
    .values({
      id: INSTANCE_ID,
      setupTokenHash: envToken ? digest(envToken) : null,
    })
    .onConflictDoNothing();
  const [instance] = await getDb()
    .select()
    .from(instanceSetup)
    .where(eq(instanceSetup.id, INSTANCE_ID))
    .limit(1);
  return instance;
}

export async function completeSetup(input: z.infer<typeof setupSchema>) {
  await ensureInstance();
  const passwordHash = await hashPassword(input.password);
  const result = await getDb().transaction(async (tx) => {
    const locked = await tx.execute(
      sql`SELECT * FROM instance_setup WHERE id = ${INSTANCE_ID} FOR UPDATE`,
    );
    const instance = locked[0] as unknown as
      { setup_complete: boolean; setup_token_hash: string | null } | undefined;
    if (!instance || instance.setup_complete)
      throw new ApiError(
        409,
        "setup_complete",
        "Diese Instanz wurde bereits eingerichtet.",
      );
    if (
      instance.setup_token_hash &&
      (!input.setupToken ||
        digest(input.setupToken) !== instance.setup_token_hash)
    )
      throw new ApiError(
        403,
        "invalid_setup_token",
        "Der Setup-Link ist ungültig oder abgelaufen.",
      );

    const [user] = await tx
      .insert(users)
      .values({
        email: input.email,
        name: input.name,
        passwordHash,
        locale: input.locale,
      })
      .returning();
    const baseSlug = slugify(input.workspace) || "scope";
    const [workspace] = await tx
      .insert(workspaces)
      .values({
        name: input.workspace,
        slug: `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`,
        mode: input.mode,
        nextTaskNumber: 1,
      })
      .returning();
    await tx
      .insert(memberships)
      .values({ workspaceId: workspace.id, userId: user.id, role: "owner" });
    const template = templateFor(input.template);
    const [project] = await tx
      .insert(projects)
      .values({
        workspaceId: workspace.id,
        name: template.name,
        description: template.description,
        key: template.key,
        createdBy: user.id,
      })
      .returning();
    if (template.tasks.length) {
      await tx
        .insert(tasks)
        .values(
          template.tasks.map((task, index) => ({
            projectId: project.id,
            number: index + 1,
            title: task,
            status:
              index === 0 ? ("in-progress" as const) : ("backlog" as const),
            priority: index === 0 ? ("high" as const) : ("medium" as const),
            position: index,
            createdBy: user.id,
            assigneeId: user.id,
          })),
        );
      await tx
        .update(workspaces)
        .set({
          nextTaskNumber: template.tasks.length + 1,
          updatedAt: new Date(),
        })
        .where(eq(workspaces.id, workspace.id));
    }
    await tx
      .insert(aiPolicies)
      .values({
        workspaceId: workspace.id,
        maxAutonomy: "suggest",
        allowedActions: ["task.create", "task.update", "subtask.create"],
      });
    if (input.provider)
      await tx
        .insert(aiProviderConfigs)
        .values({
          workspaceId: workspace.id,
          provider: input.provider.type,
          name: input.provider.name,
          endpoint: input.provider.endpoint,
          encryptedSecret: input.provider.apiKey
            ? encryptSecret(input.provider.apiKey)
            : null,
          models: input.provider.model ? [input.provider.model] : [],
        });
    await tx
      .update(instanceSetup)
      .set({
        setupComplete: true,
        setupTokenHash: null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(instanceSetup.id, INSTANCE_ID));
    return { user, workspace, project };
  });
  return result;
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
function templateFor(
  template: "blank" | "software" | "marketing" | "personal",
) {
  if (template === "software")
    return {
      name: "Produkt-Launch",
      key: "SCO",
      description: "Die erste Version strukturiert umsetzen.",
      tasks: [
        "Produktumfang festziehen",
        "Ersten Vertical Slice umsetzen",
        "Release prüfen",
      ],
    };
  if (template === "marketing")
    return {
      name: "Kampagne",
      key: "MKT",
      description: "Von der Idee bis zur Veröffentlichung.",
      tasks: [
        "Ziel und Zielgruppe definieren",
        "Inhalte produzieren",
        "Veröffentlichung vorbereiten",
      ],
    };
  if (template === "personal")
    return {
      name: "Mein Projekt",
      key: "ME",
      description: "Ein Vorhaben in klare nächste Schritte bringen.",
      tasks: ["Ergebnis definieren", "Nächsten Schritt planen"],
    };
  return {
    name: "Erstes Projekt",
    key: "SCO",
    description: "",
    tasks: [] as string[],
  };
}

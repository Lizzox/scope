import { desc, eq, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { automationRuns, automations } from "@/lib/db/schema";
import { apiError, ok } from "@/lib/http/api";
import { uuidSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const workspaceId = uuidSchema.parse(request.nextUrl.searchParams.get("workspaceId"));
    await requireWorkspace(request, workspaceId);
    const ids = (await getDb().select({ id: automations.id }).from(automations).where(eq(automations.workspaceId, workspaceId))).map((row) => row.id);
    return ok(ids.length ? await getDb().select().from(automationRuns).where(inArray(automationRuns.automationId, ids)).orderBy(desc(automationRuns.createdAt)).limit(100) : []);
  } catch (error) { return apiError(error); }
}

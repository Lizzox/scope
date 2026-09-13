import { and, count, eq, gte, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { aiRuns } from "@/lib/db/schema";
import { apiError, ok } from "@/lib/http/api";
import { uuidSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const workspaceId = uuidSchema.parse(request.nextUrl.searchParams.get("workspaceId"));
    await requireWorkspace(request, workspaceId);
    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const [month] = await getDb().select({ runs: count(), inputTokens: sql<number>`coalesce(sum(${aiRuns.inputTokens}), 0)`, outputTokens: sql<number>`coalesce(sum(${aiRuns.outputTokens}), 0)`, costMicros: sql<number>`coalesce(sum(${aiRuns.estimatedCostMicros}), 0)` }).from(aiRuns).where(and(eq(aiRuns.workspaceId, workspaceId), gte(aiRuns.createdAt, monthStart)));
    const [total] = await getDb().select({ runs: count(), tokens: sql<number>`coalesce(sum(coalesce(${aiRuns.inputTokens}, 0) + coalesce(${aiRuns.outputTokens}, 0)), 0)` }).from(aiRuns).where(eq(aiRuns.workspaceId, workspaceId));
    return ok({ month: { runs: Number(month.runs), inputTokens: Number(month.inputTokens), outputTokens: Number(month.outputTokens), tokens: Number(month.inputTokens) + Number(month.outputTokens), costMicros: Number(month.costMicros) }, total: { runs: Number(total.runs), tokens: Number(total.tokens) } });
  } catch (error) { return apiError(error); }
}

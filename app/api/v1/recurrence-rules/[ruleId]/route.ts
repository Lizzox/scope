import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireProject } from "@/lib/auth/resources";
import { getDb } from "@/lib/db/client";
import { recurrenceRules } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";
import { recurrenceUpdateSchema } from "@/lib/validation";

type Context = { params: Promise<{ ruleId: string }> };
async function access(request: NextRequest, ruleId: string) { const [rule] = await getDb().select().from(recurrenceRules).where(eq(recurrenceRules.id, ruleId)).limit(1); if (!rule) throw new ApiError(404, "recurrence_not_found", "Wiederholungsregel nicht gefunden."); return { rule, ...(await requireProject(request, rule.projectId)) }; }
export async function PATCH(request: NextRequest, context: Context) { try { assertSameOrigin(request); const { ruleId } = await context.params; const current = await access(request, ruleId); const input = await parseJson(request, recurrenceUpdateSchema); const [rule] = await getDb().update(recurrenceRules).set({ ...input, nextOccurrenceAt: input.nextOccurrenceAt ? new Date(input.nextOccurrenceAt) : current.rule.nextOccurrenceAt, endsAt: input.endsAt === undefined ? current.rule.endsAt : input.endsAt ? new Date(input.endsAt) : null, updatedAt: new Date() }).where(eq(recurrenceRules.id, ruleId)).returning(); return ok(rule); } catch (error) { return apiError(error); } }
export async function DELETE(request: NextRequest, context: Context) { try { assertSameOrigin(request); const { ruleId } = await context.params; await access(request, ruleId); const [rule] = await getDb().update(recurrenceRules).set({ active: false, updatedAt: new Date() }).where(eq(recurrenceRules.id, ruleId)).returning(); return ok(rule); } catch (error) { return apiError(error); } }

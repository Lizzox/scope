import { asc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireProject } from "@/lib/auth/resources";
import { getDb } from "@/lib/db/client";
import { recurrenceRules } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { enqueueJob } from "@/lib/jobs/queue";
import { recurrenceCreateSchema, uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) { try { const projectId = uuidSchema.parse(request.nextUrl.searchParams.get("projectId")); await requireProject(request, projectId); return ok(await getDb().select().from(recurrenceRules).where(eq(recurrenceRules.projectId, projectId)).orderBy(asc(recurrenceRules.nextOccurrenceAt))); } catch (error) { return apiError(error); } }
export async function POST(request: NextRequest) { try { assertSameOrigin(request); const input = await parseJson(request, recurrenceCreateSchema); const access = await requireProject(request, input.projectId); const [rule] = await getDb().insert(recurrenceRules).values({ ...input, nextOccurrenceAt: new Date(input.nextOccurrenceAt), endsAt: input.endsAt ? new Date(input.endsAt) : null, createdBy: access.user.id }).returning(); await enqueueJob("recurrence.generate", { ruleId: rule.id }, rule.nextOccurrenceAt); return ok(rule, { status: 201 }); } catch (error) { return apiError(error); } }

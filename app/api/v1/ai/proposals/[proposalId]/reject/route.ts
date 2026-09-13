import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { aiProposals, aiRuns } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";

type Context = { params: Promise<{ proposalId: string }> };
export async function POST(request: NextRequest, context: Context) { try { assertSameOrigin(request); const { proposalId } = await context.params; const [record] = await getDb().select({ proposal: aiProposals, run: aiRuns }).from(aiProposals).innerJoin(aiRuns, eq(aiRuns.id, aiProposals.runId)).where(eq(aiProposals.id, proposalId)).limit(1); if (!record) throw new ApiError(404, "proposal_not_found", "KI-Vorschlag nicht gefunden."); await requireWorkspace(request, record.run.workspaceId); if (record.proposal.appliedAt || record.proposal.rejectedAt) throw new ApiError(409, "proposal_resolved", "Dieser Vorschlag wurde bereits verarbeitet."); const [proposal] = await getDb().update(aiProposals).set({ rejectedAt: new Date(), updatedAt: new Date() }).where(eq(aiProposals.id, proposalId)).returning(); await getDb().update(aiRuns).set({ status: "cancelled", updatedAt: new Date() }).where(eq(aiRuns.id, record.run.id)); return ok(proposal); } catch (error) { return apiError(error); } }

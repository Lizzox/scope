import type { NextRequest } from "next/server";
import { applyProposal } from "@/lib/ai/runs";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { proposalApplySchema } from "@/lib/validation";

type Context = { params: Promise<{ proposalId: string }> };
export async function POST(request: NextRequest, context: Context) { try { assertSameOrigin(request); const { proposalId } = await context.params; const input = await parseJson(request, proposalApplySchema); return ok(await applyProposal(request, proposalId, input.operationIds)); } catch (error) { return apiError(error); } }

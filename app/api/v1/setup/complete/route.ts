import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { attachSession } from "@/lib/auth/session";
import { apiError, assertSameOrigin, parseJson, requestFingerprint } from "@/lib/http/api";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { completeSetup } from "@/lib/setup";
import { setupSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(`setup:${requestFingerprint(request)}`, 10, 3600);
    const result = await completeSetup(await parseJson(request, setupSchema));
    const response = NextResponse.json({ data: { workspaceId: result.workspace.id, projectId: result.project.id }, meta: { timestamp: new Date().toISOString() } }, { status: 201 });
    await attachSession(response, result.user.id);
    return response;
  } catch (error) { return apiError(error); }
}

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";
import { apiError, assertSameOrigin } from "@/lib/http/api";

export async function POST(request: NextRequest) { try { assertSameOrigin(request); const response = new NextResponse(null, { status: 204 }); await clearSession(request, response); return response; } catch (error) { return apiError(error); } }

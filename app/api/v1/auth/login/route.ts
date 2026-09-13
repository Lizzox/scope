import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { attachSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { apiError, assertSameOrigin, parseJson, requestFingerprint } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { loginSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(`login:${requestFingerprint(request)}`, 10, 900);
    const input = await parseJson(request, loginSchema);
    const [user] = await getDb().select().from(users).where(eq(users.email, input.email)).limit(1);
    if (!user || !await verifyPassword(input.password, user.passwordHash)) throw new ApiError(401, "invalid_credentials", "E-Mail oder Passwort ist nicht korrekt.");
    const response = NextResponse.json({ data: { id: user.id, name: user.name, email: user.email }, meta: { timestamp: new Date().toISOString() } });
    await attachSession(response, user.id);
    return response;
  } catch (error) { return apiError(error); }
}

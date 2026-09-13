import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { sessions, users } from "@/lib/db/schema";

export const SESSION_COOKIE = "scope_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const secureCookie = () => (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://");

export function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }

export async function attachSession(response: NextResponse, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000);
  await getDb().insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt });
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "strict", secure: secureCookie(), path: "/", maxAge: SESSION_SECONDS });
}

export async function clearSession(request: NextRequest, response: NextResponse) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", secure: secureCookie(), path: "/", maxAge: 0 });
}

export async function getSessionUser(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [record] = await getDb().select({ id: users.id, email: users.email, name: users.name, locale: users.locale, appearance: users.appearance, themePreferences: users.themePreferences, preferredAutonomy: users.preferredAutonomy, sessionId: sessions.id })
    .from(sessions).innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date()))).limit(1);
  if (!record) return null;
  void getDb().update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, record.sessionId));
  return record;
}

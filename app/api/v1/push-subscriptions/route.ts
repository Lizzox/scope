import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { pushSubscriptions } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";

export async function GET(request: NextRequest) { try { await requireUser(request); return ok({ publicKey: process.env.SCOPE_VAPID_PUBLIC_KEY || null, available: Boolean(process.env.SCOPE_VAPID_PUBLIC_KEY && process.env.SCOPE_VAPID_PRIVATE_KEY) }); } catch (error) { return apiError(error); } }
export async function POST(request: NextRequest) { try { assertSameOrigin(request); const user = await requireUser(request); const payload = await request.json() as { endpoint?: string; keys?: unknown }; if (!payload.endpoint || payload.endpoint.length > 4000) throw new ApiError(422, "invalid_subscription", "Ungültige Push-Subscription."); const [subscription] = await getDb().insert(pushSubscriptions).values({ userId: user.id, endpoint: payload.endpoint, subscription: payload }).onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId: user.id, subscription: payload } }).returning(); return ok(subscription, { status: 201 }); } catch (error) { return apiError(error); } }
export async function DELETE(request: NextRequest) { try { assertSameOrigin(request); const user = await requireUser(request); const payload = await request.json() as { endpoint?: string }; if (!payload.endpoint) throw new ApiError(422, "invalid_subscription", "Endpoint fehlt."); return ok(await getDb().delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, payload.endpoint), eq(pushSubscriptions.userId, user.id))).returning()); } catch (error) { return apiError(error); } }

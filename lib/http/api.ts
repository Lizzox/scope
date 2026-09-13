import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { ApiError } from "./errors";

export async function parseJson<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) throw new ApiError(415, "unsupported_media_type", "Content-Type muss application/json sein.");
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 1_000_000) throw new ApiError(413, "payload_too_large", "Die Anfrage ist zu groß.");
  let value: unknown;
  try { value = await request.json(); } catch { throw new ApiError(400, "invalid_json", "Die Anfrage enthält kein gültiges JSON."); }
  return schema.parse(value);
}

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "same-site" && site !== "none") throw new ApiError(403, "cross_site_request", "Cross-Site-Anfrage abgelehnt.");
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin : null;
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const publicOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : request.nextUrl.origin;
  if (origin && origin !== request.nextUrl.origin && origin !== configuredOrigin && origin !== publicOrigin) throw new ApiError(403, "invalid_origin", "Anfrageursprung abgelehnt.");
}

export function requestFingerprint(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return createHash("sha256").update(`${forwarded ?? "local"}:${request.headers.get("user-agent") ?? "unknown"}`).digest("hex").slice(0, 24);
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data, meta: { requestId: randomUUID(), timestamp: new Date().toISOString() } }, init);
}

export function apiError(error: unknown) {
  const requestId = randomUUID();
  if (error instanceof ZodError) return NextResponse.json({ error: { code: "validation_failed", message: "Eingaben prüfen.", fields: error.flatten().fieldErrors, requestId } }, { status: 422 });
  if (error instanceof ApiError) return NextResponse.json({ error: { code: error.code, message: error.message, details: error.details, requestId } }, { status: error.status });
  console.error("Unhandled API error", { requestId, error: error instanceof Error ? error.message : "unknown" });
  return NextResponse.json({ error: { code: "internal_error", message: "Die Anfrage konnte nicht verarbeitet werden.", requestId } }, { status: 500 });
}

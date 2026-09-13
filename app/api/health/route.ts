import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json(
      {
        status: "ok",
        service: "scope",
        version: process.env.SCOPE_VERSION ?? "dev",
        checks: { database: "ok" },
        timestamp,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        status: "unavailable",
        service: "scope",
        version: process.env.SCOPE_VERSION ?? "dev",
        checks: { database: "unavailable" },
        timestamp,
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

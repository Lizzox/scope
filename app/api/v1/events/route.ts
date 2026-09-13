import { and, asc, eq, gt } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { activityEvents } from "@/lib/db/schema";
import { apiError } from "@/lib/http/api";
import { uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const workspaceId = uuidSchema.parse(request.nextUrl.searchParams.get("workspaceId"));
    await requireWorkspace(request, workspaceId);
    const encoder = new TextEncoder();
    let cursor = new Date(request.headers.get("last-event-id") || request.nextUrl.searchParams.get("since") || Date.now());
    let timer: ReturnType<typeof setInterval> | undefined;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`event: ready\ndata: ${JSON.stringify({ workspaceId })}\n\n`));
        timer = setInterval(async () => {
          try {
            const rows = await getDb().select().from(activityEvents).where(and(eq(activityEvents.workspaceId, workspaceId), gt(activityEvents.createdAt, cursor))).orderBy(asc(activityEvents.createdAt)).limit(100);
            for (const row of rows) { controller.enqueue(encoder.encode(`id: ${row.createdAt.toISOString()}\nevent: activity\ndata: ${JSON.stringify(row)}\n\n`)); cursor = row.createdAt; }
            if (!rows.length) controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
          } catch { controller.error(new Error("event_stream_failed")); if (timer) clearInterval(timer); }
        }, 2_000);
      },
      cancel() { if (timer) clearInterval(timer); },
    });
    return new Response(stream, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } });
  } catch (error) { return apiError(error); }
}

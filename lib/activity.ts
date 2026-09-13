import "server-only";
import { activityEvents, jobs } from "@/lib/db/schema";
import { getDb } from "@/lib/db/client";

export async function recordActivity(input: { workspaceId: string; actorId?: string | null; actorType?: string; entityType: string; entityId: string; action: string; payload?: unknown; undoPayload?: unknown }) {
  const [event] = await getDb().insert(activityEvents).values({ workspaceId: input.workspaceId, actorId: input.actorId, actorType: input.actorType ?? "user", entityType: input.entityType, entityId: input.entityId, action: input.action, payload: input.payload ?? {}, undoPayload: input.undoPayload }).returning();
  await getDb().insert(jobs).values({ type: "automation.dispatch", payload: { eventId: event.id, workspaceId: input.workspaceId }, runAt: new Date() });
  return event;
}

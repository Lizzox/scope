import "server-only";
import { getDb } from "@/lib/db/client";
import { jobs } from "@/lib/db/schema";

export async function enqueueJob(type: string, payload: Record<string, unknown>, runAt = new Date()) {
  const [job] = await getDb().insert(jobs).values({ type, payload, runAt }).returning();
  return job;
}

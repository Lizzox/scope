import "server-only";
import { getDb } from "@/lib/db/client";
import { jobs, notifications } from "@/lib/db/schema";

export async function createNotification(input: typeof notifications.$inferInsert) {
  const [notification] = await getDb().insert(notifications).values(input).returning();
  await getDb().insert(jobs).values({ type: "notification.deliver", payload: { notificationId: notification.id }, runAt: new Date() });
  return notification;
}

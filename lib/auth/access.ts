import "server-only";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { memberships } from "@/lib/db/schema";
import { ApiError } from "@/lib/http/errors";
import { getSessionUser } from "./session";

export type WorkspaceRole = "owner" | "admin" | "member";

export async function requireUser(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) throw new ApiError(401, "authentication_required", "Bitte erneut anmelden.");
  return user;
}

export async function requireWorkspace(request: NextRequest, workspaceId: string, allowed?: WorkspaceRole[]) {
  const user = await requireUser(request);
  const [membership] = await getDb().select().from(memberships).where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, user.id))).limit(1);
  if (!membership || (allowed && !allowed.includes(membership.role))) throw new ApiError(403, "forbidden", "Für diese Aktion fehlt die Berechtigung.");
  return { user, membership };
}

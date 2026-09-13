import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { attachSession, getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { invitations, memberships, users } from "@/lib/db/schema";
import { apiError, assertSameOrigin, parseJson, requestFingerprint } from "@/lib/http/api";
import { ApiError, isUniqueViolation } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { inviteAcceptSchema } from "@/lib/validation";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(`invitation-accept:${requestFingerprint(request)}`, 20, 3600);
    const input = await parseJson(request, inviteAcceptSchema);
    const sessionUser = await getSessionUser(request);
    if (!sessionUser && (!input.name || !input.email || !input.password)) throw new ApiError(401, "account_details_required", "Für die Einladung wird ein Konto benötigt.");
    const passwordHash = !sessionUser && input.password ? await hashPassword(input.password) : undefined;

    let result: { membership: typeof memberships.$inferSelect | undefined; userId: string; createdUser: boolean };
    try {
      result = await getDb().transaction(async (tx) => {
        let userId = sessionUser?.id;
        let createdUser = false;
        if (!userId) {
          const [created] = await tx.insert(users).values({ name: input.name!, email: input.email!, passwordHash: passwordHash! }).returning();
          userId = created.id;
          createdUser = true;
        }
        const [invite] = await tx.update(invitations).set({ usedAt: new Date(), usedBy: userId, updatedAt: new Date() }).where(and(eq(invitations.tokenHash, hash(input.token)), isNull(invitations.usedAt), isNull(invitations.revokedAt), gt(invitations.expiresAt, new Date()))).returning();
        if (!invite) throw new ApiError(410, "invitation_expired", "Diese Einladung ist ungültig oder abgelaufen.");
        const [membership] = await tx.insert(memberships).values({ workspaceId: invite.workspaceId, userId, role: invite.role }).onConflictDoNothing().returning();
        return { membership, userId, createdUser };
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiError(409, "email_exists", "Für diese E-Mail existiert bereits ein Konto. Bitte anmelden.");
      throw error;
    }
    const response = NextResponse.json({ data: result.membership ?? { existing: true }, meta: { timestamp: new Date().toISOString() } }, { status: 201 });
    if (result.createdUser) await attachSession(response, result.userId);
    return response;
  } catch (error) { return apiError(error); }
}

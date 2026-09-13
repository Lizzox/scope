import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { automations } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";
import { automationUpdateSchema } from "@/lib/validation";

type Context = { params: Promise<{ automationId: string }> };
async function access(request: NextRequest, id: string) {
  const [automation] = await getDb().select().from(automations).where(eq(automations.id, id)).limit(1);
  if (!automation) throw new ApiError(404, "automation_not_found", "Automation nicht gefunden.");
  const auth = await requireWorkspace(request, automation.workspaceId);
  if (automation.createdBy !== auth.user.id && !["owner", "admin"].includes(auth.membership.role)) throw new ApiError(403, "automation_forbidden", "Automation darf nicht geändert werden.");
  return { automation, ...auth };
}
export async function PATCH(request: NextRequest, context: Context) { try { assertSameOrigin(request); const { automationId } = await context.params; const current = await access(request, automationId); const input = await parseJson(request, automationUpdateSchema); if (input.status === "active" && !["owner", "admin"].includes(current.membership.role)) throw new ApiError(403, "automation_approval_required", "Aktive Automationen müssen durch Owner oder Admins freigegeben werden."); const [automation] = await getDb().update(automations).set({ ...input, updatedAt: new Date() }).where(eq(automations.id, automationId)).returning(); return ok(automation); } catch (error) { return apiError(error); } }
export async function DELETE(request: NextRequest, context: Context) { try { assertSameOrigin(request); const { automationId } = await context.params; await access(request, automationId); const [automation] = await getDb().update(automations).set({ status: "disabled", updatedAt: new Date() }).where(eq(automations.id, automationId)).returning(); return ok(automation); } catch (error) { return apiError(error); } }

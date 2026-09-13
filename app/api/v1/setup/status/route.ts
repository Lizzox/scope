import { apiError, ok } from "@/lib/http/api";
import { ensureInstance } from "@/lib/setup";

export const dynamic = "force-dynamic";
export async function GET() { try { const instance = await ensureInstance(); return ok({ setupComplete: Boolean(instance?.setupComplete), tokenRequired: Boolean(instance?.setupTokenHash) }); } catch (error) { return apiError(error); } }

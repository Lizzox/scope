import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { apiError, assertSameOrigin, ok, parseJson } from "@/lib/http/api";
import { ApiError } from "@/lib/http/errors";
import { validateTheme } from "@/lib/theme";
import { profileUpdateSchema } from "@/lib/validation";

export async function PATCH(request: NextRequest) { try { assertSameOrigin(request); const user = await requireUser(request); const input = await parseJson(request, profileUpdateSchema); if (input.themePreferences && "customTheme" in input.themePreferences) { const result = validateTheme(input.themePreferences.customTheme); if (!result.valid) throw new ApiError(422, "invalid_theme", result.error ?? "Das Theme ist ungültig."); } const [updated] = await getDb().update(users).set({ ...input, updatedAt: new Date() }).where(eq(users.id, user.id)).returning({ id: users.id, email: users.email, name: users.name, locale: users.locale, appearance: users.appearance, themePreferences: users.themePreferences, preferredAutonomy: users.preferredAutonomy }); return ok(updated); } catch (error) { return apiError(error); } }

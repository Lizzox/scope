import type { NextRequest } from "next/server";
import { getBootstrap } from "@/lib/bootstrap";
import { apiError, ok } from "@/lib/http/api";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) { try { return ok(await getBootstrap(request)); } catch (error) { return apiError(error); } }

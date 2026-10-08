import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { authService } from "@/modules/auth/auth.container";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  try {
    const psicologoId = await verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (psicologoId === null) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401, headers });
    }
    const psychologist = await authService.findCurrent(psicologoId);
    if (!psychologist) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401, headers });
    }
    return NextResponse.json(psychologist, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500, headers });
  }
}

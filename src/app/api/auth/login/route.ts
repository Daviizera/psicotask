import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/auth/origin";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { authService } from "@/modules/auth/auth.container";
import { loginSchema } from "@/modules/auth/schemas/login.schema";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Origem não permitida" }, { status: 403, headers });
  }

  let body: unknown;
  try {
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      throw new Error("JSON obrigatório");
    }
    body = await request.json();
  } catch {
    return NextResponse.json({
      error: "Dados inválidos",
      details: [{ path: [], message: "O corpo deve conter um JSON válido com Content-Type application/json." }],
    }, { status: 400, headers });
  }

  const result = loginSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({
      error: "Dados inválidos",
      details: result.error.issues.map(({ path, message }) => ({ path, message })),
    }, { status: 400, headers });
  }

  try {
    const psychologist = await authService.authenticate(result.data);
    if (!psychologist) {
      return NextResponse.json({ error: "E-mail ou senha inválidos" }, { status: 401, headers });
    }
    const token = await createSessionToken(psychologist.id);
    const response = NextResponse.json(psychologist, { status: 200, headers });
    response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    return response;
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500, headers });
  }
}

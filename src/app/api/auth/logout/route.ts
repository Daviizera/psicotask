import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/auth/origin";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Origem não permitida" }, { status: 403, headers });
  }
  const response = new NextResponse(null, { status: 204, headers });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}

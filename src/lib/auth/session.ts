import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "psicotask_session";
export const SESSION_DURATION_SECONDS = 8 * 60 * 60;

function sessionKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret?.trim() || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("AUTH_SECRET deve estar configurado com um segredo de pelo menos 32 bytes.");
  }
  return new TextEncoder().encode(secret);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DURATION_SECONDS,
  };
}

export async function createSessionToken(psicologoId: number): Promise<string> {
  if (!Number.isInteger(psicologoId) || psicologoId <= 0 || psicologoId > 2147483647) {
    throw new Error("Identificador de sessão inválido.");
  }
  const issuedAt = Math.floor(Date.now() / 1000);
  return new SignJWT({ psicologoId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_DURATION_SECONDS)
    .sign(sessionKey());
}

export async function verifySessionToken(token: string | undefined): Promise<number | null> {
  if (!token) return null;
  // Falha de configuração não deve ser confundida com credenciais inválidas.
  const key = sessionKey();
  if (token.length > 4096) return null;
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      typ: "JWT",
      requiredClaims: ["psicologoId", "iat", "exp"],
      maxTokenAge: SESSION_DURATION_SECONDS,
    });
    const { psicologoId, iat, exp } = payload;
    if (
      typeof psicologoId !== "number" || !Number.isInteger(psicologoId) ||
      psicologoId <= 0 || psicologoId > 2147483647 ||
      typeof iat !== "number" || !Number.isInteger(iat) ||
      typeof exp !== "number" || !Number.isInteger(exp) ||
      exp <= iat || exp - iat > SESSION_DURATION_SECONDS
    ) return null;
    return psicologoId;
  } catch {
    return null;
  }
}

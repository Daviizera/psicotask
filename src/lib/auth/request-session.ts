import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./session";

// cookies() usa o contexto da requisição do Next; a identidade nunca é global.
export async function readSessionPsychologistId(): Promise<number | null> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

import { prisma } from "@/lib/prisma";
import { AuthenticationError } from "@/lib/auth/authentication.error";
import { readSessionPsychologistId } from "@/lib/auth/request-session";

// Repositories dependem apenas deste resolvedor, sem ler cookies ou tokens.
export async function getCurrentPsychologistId(): Promise<number> {
  const id = await readSessionPsychologistId();
  if (id === null) throw new AuthenticationError();

  // Um token válido não autoriza um perfil que já tenha sido removido.
  const psychologist = await prisma.psicologo.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!psychologist) throw new AuthenticationError();
  return psychologist.id;
}

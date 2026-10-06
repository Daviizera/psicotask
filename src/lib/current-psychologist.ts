import { developmentPsychologist } from "@/config/development-psychologist";
import { prisma } from "@/lib/prisma";

// Ponto temporário de resolução do proprietário, substituível pela autenticação.
// Os CRUDs em memória ainda não utilizam esta função.
export async function getCurrentPsychologistId(): Promise<number> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("O psicólogo de desenvolvimento não está disponível em produção.");
  }

  const psychologist = await prisma.psicologo.findUnique({
    where: { email: developmentPsychologist.email },
    select: { id: true },
  });

  if (!psychologist) {
    throw new Error(
      "Psicólogo de desenvolvimento não encontrado. Execute npm run prisma:seed.",
    );
  }

  return psychologist.id;
}

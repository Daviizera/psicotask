import { prisma } from "@/lib/prisma";

// Ponto temporário de resolução do proprietário, substituível pela autenticação.
// Não depende de campos editáveis do perfil nem de um ID fixo.
export async function getCurrentPsychologistId(): Promise<number> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("O psicólogo de desenvolvimento não está disponível em produção.");
  }

  const psychologists = await prisma.psicologo.findMany({
    take: 2,
    select: { id: true },
  });

  if (psychologists.length === 0) {
    throw new Error(
      "Psicólogo de desenvolvimento não encontrado. Execute npm run prisma:seed.",
    );
  }

  if (psychologists.length > 1) {
    throw new Error(
      "Estado de desenvolvimento ambíguo: existe mais de um psicólogo.",
    );
  }

  return psychologists[0].id;
}

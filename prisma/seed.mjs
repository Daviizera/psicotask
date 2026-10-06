import { randomBytes, scryptSync } from "node:crypto";
import { config } from "dotenv";
import { createJiti } from "jiti";

// Apenas o script Node precisa carregar .env; o Next.js faz isso na aplicação.
config({ quiet: true });

const jiti = createJiti(import.meta.url, { tsconfigPaths: true, fsCache: false });

function validateDevelopmentTarget() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed de desenvolvimento: execução em produção não permitida.");
  }

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("Seed de desenvolvimento: DATABASE_URL não configurada.");
  }

  let url;
  try {
    url = new URL(process.env.DATABASE_URL);
  } catch {
    throw new Error("Seed de desenvolvimento: DATABASE_URL inválida.");
  }

  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.pathname !== "/psicotask_dev_v2" ||
    (url.searchParams.get("schema") ?? "public") !== "public"
  ) {
    throw new Error("Seed de desenvolvimento: use somente psicotask_dev_v2/public.");
  }
}

function createPasswordHash() {
  const password = randomBytes(32);
  const salt = randomBytes(16);

  try {
    // scrypt nativo: N=2^17, r=8, p=1; não adiciona dependência de autenticação.
    const hash = scryptSync(password, salt, 64, {
      N: 131072,
      r: 8,
      p: 1,
      maxmem: 256 * 1024 * 1024,
    });

    return `scrypt$131072$8$1$${salt.toString("hex")}$${hash.toString("hex")}`;
  } finally {
    // Sem login nesta fase: a senha aleatória não é persistida nem exibida.
    password.fill(0);
  }
}

async function main() {
  validateDevelopmentTarget();
  const { prisma } = await jiti.import("../src/lib/prisma.ts");

  try {
    const [target] = await prisma.$queryRaw`SELECT current_database() AS database`;
    if (target.database !== "psicotask_dev_v2") {
      throw new Error("Seed de desenvolvimento: banco alvo inesperado.");
    }

    // Serializa a verificação/criação para evitar duplicação em execuções concorrentes.
    await prisma.$transaction(
      async (transaction) => {
        const psychologists = await transaction.psicologo.findMany({
          take: 2,
          select: { id: true },
        });

        if (psychologists.length > 1) {
          throw new Error(
            "Seed de desenvolvimento: estado ambíguo, existe mais de um psicólogo.",
          );
        }

        if (psychologists.length === 1) return;

        const { developmentPsychologist } = await jiti.import(
          "../src/config/development-psychologist.ts",
        );

        await transaction.psicologo.create({
          data: { ...developmentPsychologist, senhaHash: createPasswordHash() },
          select: { id: true },
        });
      },
      { isolationLevel: "Serializable" },
    );

    console.log("Psicólogo de desenvolvimento preparado com sucesso.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  const message =
    error instanceof Error && error.message.startsWith("Seed de desenvolvimento:")
      ? error.message
      : "Falha no seed de desenvolvimento. Verifique a conexão e a migration aplicada.";
  console.error(message);
  process.exitCode = 1;
});

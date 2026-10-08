import { config } from "dotenv";
import { createJiti } from "jiti";

// Apenas o script Node precisa carregar .env; o Next.js faz isso na aplicação.
config({ quiet: true });

const jiti = createJiti(import.meta.url, { tsconfigPaths: true, fsCache: false });

function validateDevelopmentTarget() {
  if (process.env.NODE_ENV && process.env.NODE_ENV !== "development") {
    throw new Error("Seed de desenvolvimento: use somente NODE_ENV=development ou não definido.");
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

function getDevelopmentPassword() {
  const password = process.env.DEV_PSYCHOLOGIST_PASSWORD;
  if (
    !password?.trim() ||
    password === "defina-uma-senha-local" ||
    password.length > 1024
  ) {
    throw new Error(
      "Seed de desenvolvimento: configure DEV_PSYCHOLOGIST_PASSWORD localmente, com até 1024 caracteres, sem usar o placeholder.",
    );
  }

  return password;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--reset-password")) {
    throw new Error("Seed de desenvolvimento: argumento inválido; a única opção é --reset-password.");
  }

  const resetPassword = args[0] === "--reset-password";
  validateDevelopmentTarget();
  // Um reset exige a senha mesmo se o banco estiver vazio ou em estado ambíguo.
  if (resetPassword) getDevelopmentPassword();
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
          select: { id: true, email: true, registroProfissional: true },
        });

        if (psychologists.length > 1) {
          throw new Error(
            "Seed de desenvolvimento: estado ambíguo, existe mais de um psicólogo.",
          );
        }

        if (psychologists.length === 1 && !resetPassword) return;

        if (psychologists.length === 0 && resetPassword) {
          throw new Error("Seed de desenvolvimento: --reset-password exige um psicólogo fictício já existente.");
        }

        const { developmentPsychologist } = await jiti.import(
          "../src/config/development-psychologist.ts",
        );

        const psychologist = psychologists[0];
        if (
          resetPassword &&
          (psychologist.email !== developmentPsychologist.email ||
            psychologist.registroProfissional !== developmentPsychologist.registroProfissional)
        ) {
          throw new Error("Seed de desenvolvimento: o perfil existente não corresponde ao psicólogo fictício configurado; nenhuma senha foi alterada.");
        }

        const { hashPassword } = await jiti.import("../src/lib/auth/password.ts");
        const senhaHash = await hashPassword(getDevelopmentPassword());

        if (resetPassword) {
          // A identidade também faz parte da escrita; nenhum dado público é alterado.
          await transaction.psicologo.update({
            where: {
              id: psychologist.id,
              email: developmentPsychologist.email,
              registroProfissional: developmentPsychologist.registroProfissional,
            },
            data: { senhaHash },
            select: { id: true },
          });
        } else {
          await transaction.psicologo.create({
            data: { ...developmentPsychologist, senhaHash },
            select: { id: true },
          });
        }
      },
      { isolationLevel: "Serializable" },
    );

    console.log(
      resetPassword
        ? "Senha do psicólogo fictício de desenvolvimento redefinida com sucesso."
        : "Psicólogo de desenvolvimento preparado; registros existentes foram preservados.",
    );
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

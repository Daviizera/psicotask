import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl?.trim()) {
  throw new Error("DATABASE_URL não configurada para conectar ao PostgreSQL.");
}

const globalForPrisma = globalThis as typeof globalThis & {
  psicoPrisma?: PrismaClient;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

// Instância do servidor por processo; o cache evita novos pools durante hot reload.
export const prisma = globalForPrisma.psicoPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.psicoPrisma = prisma;
}

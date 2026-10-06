import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Permite validar/gerar sem credenciais; comandos de banco exigirão uma URL real.
    url: process.env.DATABASE_URL ?? "",
  },
});

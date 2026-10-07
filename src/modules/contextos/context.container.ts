import { PrismaContextRepository } from "./repositories/prisma-context.repository";
import { ContextService } from "./services/context.service";

// O repository não guarda estado; o PrismaClient/pool compartilhado está em src/lib/prisma.ts.
const contextRepository = new PrismaContextRepository();

export const contextService = new ContextService(contextRepository);

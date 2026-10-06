import { PrismaPsychologistRepository } from "./repositories/prisma-psychologist.repository";
import { PsychologistService } from "./services/psychologist.service";

// O repository não guarda estado; o PrismaClient/pool compartilhado está em src/lib/prisma.ts.
const psychologistRepository = new PrismaPsychologistRepository();

export const psychologistService = new PsychologistService(psychologistRepository);

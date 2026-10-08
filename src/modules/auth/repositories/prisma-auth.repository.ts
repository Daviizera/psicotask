import { prisma } from "@/lib/prisma";
import type { Psychologist } from "../../psicologos/types/psychologist.types";
import type { AuthCredentials, AuthRepository } from "./auth.repository";

export class PrismaAuthRepository implements AuthRepository {
  findCredentialsByEmail(email: string): Promise<AuthCredentials | null> {
    return prisma.psicologo.findUnique({
      where: { email },
      select: { id: true, senhaHash: true },
    });
  }

  findPublicById(id: number): Promise<Psychologist | null> {
    return prisma.psicologo.findUnique({
      where: { id },
      select: { id: true, nome: true, email: true, registroProfissional: true },
    });
  }
}

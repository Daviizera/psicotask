import { Prisma } from "@/generated/prisma/client";
import { getCurrentPsychologistId } from "@/lib/current-psychologist";
import { prisma } from "@/lib/prisma";
import { PsychologistConflictError } from "../errors/psychologist-conflict.error";
import type {
  Psychologist,
  UpdatePsychologistInput,
} from "../types/psychologist.types";
import type { PsychologistRepository } from "./psychologist.repository";

// registroProfissional já corresponde a registro_prof pelo @map do schema Prisma.
// A projeção pública nunca consulta ou retorna senhaHash.
const publicPsychologistSelect = {
  id: true,
  nome: true,
  email: true,
  registroProfissional: true,
} satisfies Prisma.PsicologoSelect;

export class PrismaPsychologistRepository implements PsychologistRepository {
  async findCurrent(): Promise<Psychologist> {
    const id = await getCurrentPsychologistId();

    return prisma.psicologo.findUniqueOrThrow({
      where: { id },
      select: publicPsychologistSelect,
    });
  }

  async update(data: UpdatePsychologistInput): Promise<Psychologist> {
    const id = await getCurrentPsychologistId();

    try {
      return await prisma.psicologo.update({
        where: { id },
        data: {
          nome: data.nome,
          email: data.email,
          registroProfissional: data.registroProfissional,
        },
        select: publicPsychologistSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new PsychologistConflictError();
      }

      throw error;
    }
  }
}

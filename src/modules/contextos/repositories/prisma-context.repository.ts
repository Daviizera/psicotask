import { Prisma, type Contexto } from "@/generated/prisma/client";
import { getCurrentPsychologistId } from "@/lib/current-psychologist";
import { prisma } from "@/lib/prisma";
import { ContextHasTasksError } from "../errors/context-has-tasks.error";
import type {
  Context,
  CreateContextData,
  UpdateContextInput,
} from "../types/context.types";
import type { ContextRepository } from "./context.repository";

const publicContextSelect = {
  id: true,
  nome: true,
  descricao: true,
} satisfies Prisma.ContextoSelect;

function toContext(record: Pick<Contexto, "id" | "nome" | "descricao">): Context {
  return {
    id: record.id,
    nome: record.nome,
    // Preserva o contrato opcional da API, sem expor NULL ou o proprietário.
    ...(record.descricao === null ? {} : { descricao: record.descricao }),
  };
}

export class PrismaContextRepository implements ContextRepository {
  async findAll(): Promise<Context[]> {
    const psicologoId = await getCurrentPsychologistId();
    const contexts = await prisma.contexto.findMany({
      where: { psicologoId },
      select: publicContextSelect,
    });

    return contexts.map(toContext);
  }

  async findById(id: number): Promise<Context | null> {
    const psicologoId = await getCurrentPsychologistId();
    const context = await prisma.contexto.findFirst({
      where: { id, psicologoId },
      select: publicContextSelect,
    });

    return context ? toContext(context) : null;
  }

  async create(data: CreateContextData): Promise<Context> {
    const psicologoId = await getCurrentPsychologistId();
    const context = await prisma.contexto.create({
      data: { nome: data.nome, descricao: data.descricao, psicologoId },
      select: publicContextSelect,
    });

    return toContext(context);
  }

  async update(id: number, data: UpdateContextInput): Promise<Context | null> {
    const psicologoId = await getCurrentPsychologistId();

    try {
      // O proprietário faz parte da própria atualização, sem pré-checagem separada.
      const context = await prisma.contexto.update({
        where: { id, psicologoId },
        data: { nome: data.nome, descricao: data.descricao },
        select: publicContextSelect,
      });

      return toContext(context);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return null;
      }

      throw error;
    }
  }

  async delete(id: number): Promise<boolean> {
    const psicologoId = await getCurrentPsychologistId();

    try {
      const result = await prisma.contexto.deleteMany({
        where: { id, psicologoId },
      });
      return result.count > 0;
    } catch (error) {
      // O PostgreSQL decide se a exclusão viola RESTRICT; não há pré-consulta.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003"
      ) {
        throw new ContextHasTasksError();
      }
      throw error;
    }
  }
}

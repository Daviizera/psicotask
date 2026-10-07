import { Prisma } from "@/generated/prisma/client";
import { getCurrentPsychologistId } from "@/lib/current-psychologist";
import { prisma } from "@/lib/prisma";
import { TaskContextNotFoundError } from "../errors/task-context-not-found.error";
import { taskSchema } from "../schemas/task.schema";
import type {
  CreateTaskData,
  Task,
  TaskFilters,
  UpdateTaskInput,
} from "../types/task.types";
import type { TaskRepository } from "./task.repository";

const publicTaskSelect = {
  id: true,
  contextoId: true,
  titulo: true,
  descricao: true,
  status: true,
  prioridade: true,
  prazo: true,
  dataCriacao: true,
} satisfies Prisma.TarefaSelect;

// DATE representa um dia civil. UTC é usado apenas para transportar seus
// componentes no Date exigido pelo Prisma, sem conversões pelo fuso local.
function toPrismaDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function toTask(record: Prisma.TarefaGetPayload<{ select: typeof publicTaskSelect }>): Task {
  return taskSchema.parse({
    id: record.id,
    contextoId: record.contextoId,
    titulo: record.titulo,
    ...(record.descricao === null ? {} : { descricao: record.descricao }),
    status: record.status,
    prioridade: record.prioridade,
    ...(record.prazo === null ? {} : { prazo: record.prazo.toISOString().slice(0, 10) }),
    dataCriacao: record.dataCriacao.toISOString().slice(0, 10),
  });
}

export class PrismaTaskRepository implements TaskRepository {
  private async requireContext(contextoId: number, psicologoId: number): Promise<void> {
    const context = await prisma.contexto.findFirst({
      where: { id: contextoId, psicologoId },
      select: { id: true },
    });
    if (!context) throw new TaskContextNotFoundError();
  }

  async findAll(filters: TaskFilters = {}): Promise<Task[]> {
    const psicologoId = await getCurrentPsychologistId();
    const tasks = await prisma.tarefa.findMany({
      where: {
        psicologoId,
        status: filters.status,
        prioridade: filters.prioridade,
        prazo: filters.prazo === undefined ? undefined : toPrismaDate(filters.prazo),
      },
      select: publicTaskSelect,
    });
    return tasks.map(toTask);
  }

  async findById(id: number): Promise<Task | null> {
    const psicologoId = await getCurrentPsychologistId();
    const task = await prisma.tarefa.findFirst({
      where: { id, psicologoId },
      select: publicTaskSelect,
    });
    return task ? toTask(task) : null;
  }

  async create(data: CreateTaskData): Promise<Task> {
    const psicologoId = await getCurrentPsychologistId();
    await this.requireContext(data.contextoId, psicologoId);
    try {
      const task = await prisma.tarefa.create({
        data: {
          psicologoId,
          contextoId: data.contextoId,
          titulo: data.titulo,
          descricao: data.descricao,
          status: data.status,
          prioridade: data.prioridade,
          prazo: data.prazo === undefined ? undefined : toPrismaDate(data.prazo),
          // dataCriacao e id são definidos exclusivamente pelo PostgreSQL.
        },
        select: publicTaskSelect,
      });
      return toTask(task);
    } catch (error) {
      // A FK continua protegendo o vínculo se o contexto desaparecer após a consulta.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new TaskContextNotFoundError();
      }
      throw error;
    }
  }

  async update(id: number, data: UpdateTaskInput): Promise<Task | null> {
    const psicologoId = await getCurrentPsychologistId();
    if (data.contextoId !== undefined) {
      await this.requireContext(data.contextoId, psicologoId);
    }
    try {
      const task = await prisma.tarefa.update({
        where: { id, psicologoId },
        data: {
          contextoId: data.contextoId,
          titulo: data.titulo,
          descricao: data.descricao,
          status: data.status,
          prioridade: data.prioridade,
          prazo: data.prazo === undefined ? undefined : toPrismaDate(data.prazo),
        },
        select: publicTaskSelect,
      });
      return toTask(task);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") return null;
        if (error.code === "P2003" && data.contextoId !== undefined) {
          throw new TaskContextNotFoundError();
        }
      }
      throw error;
    }
  }

  async delete(id: number): Promise<boolean> {
    const psicologoId = await getCurrentPsychologistId();
    const result = await prisma.tarefa.deleteMany({ where: { id, psicologoId } });
    return result.count > 0;
  }
}

import { randomUUID } from "node:crypto";

import type {
  CreateTaskData,
  Task,
  TaskFilters,
  UpdateTaskInput,
} from "../types/task.types";
import type { TaskRepository } from "./task.repository";

export class InMemoryTaskRepository implements TaskRepository {
  private tasks: Task[] = [
    {
      id: randomUUID(),
      titulo: "Revisar agenda semanal",
      status: "PENDENTE",
      prioridade: "MEDIA",
    },
    {
      id: randomUUID(),
      titulo: "Preparar material de estudo",
      status: "EM_ANDAMENTO",
      prioridade: "ALTA",
    },
    {
      id: randomUUID(),
      titulo: "Organizar tarefas administrativas",
      status: "PENDENTE",
      prioridade: "BAIXA",
    },
  ];

  async findAll(filters: TaskFilters = {}): Promise<Task[]> {
    return this.tasks
      .filter(
        (task) =>
          (filters.status === undefined || task.status === filters.status) &&
          (filters.prioridade === undefined || task.prioridade === filters.prioridade) &&
          (filters.prazo === undefined || task.prazo === filters.prazo),
      )
      .map((task) => ({ ...task }));
  }

  async findById(id: string): Promise<Task | null> {
    const task = this.tasks.find((task) => task.id === id);
    return task ? { ...task } : null;
  }

  async create(data: CreateTaskData): Promise<Task> {
    const task: Task = { ...data, id: randomUUID() };
    this.tasks.push(task);
    return { ...task };
  }

  async update(id: string, data: UpdateTaskInput): Promise<Task | null> {
    const task = this.tasks.find((task) => task.id === id);

    if (!task) {
      return null;
    }

    // Campos ausentes ou undefined preservam os valores atuais.
    if (data.titulo !== undefined) task.titulo = data.titulo;
    if (data.descricao !== undefined) task.descricao = data.descricao;
    if (data.status !== undefined) task.status = data.status;
    if (data.prioridade !== undefined) task.prioridade = data.prioridade;
    if (data.prazo !== undefined) task.prazo = data.prazo;

    return { ...task };
  }

  async delete(id: string): Promise<boolean> {
    const index = this.tasks.findIndex((task) => task.id === id);

    if (index === -1) {
      return false;
    }

    this.tasks.splice(index, 1);
    return true;
  }
}

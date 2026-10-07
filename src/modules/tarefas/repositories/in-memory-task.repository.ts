import type {
  CreateTaskData,
  Task,
  TaskFilters,
  UpdateTaskInput,
} from "../types/task.types";
import type { TaskRepository } from "./task.repository";

export class InMemoryTaskRepository implements TaskRepository {
  private nextId = 1;
  private tasks: Task[] = [
    {
      id: this.nextId++,
      contextoId: 1,
      dataCriacao: "2026-10-01",
      titulo: "Revisar agenda semanal",
      status: "PENDENTE",
      prioridade: "MEDIA",
    },
    {
      id: this.nextId++,
      contextoId: 1,
      dataCriacao: "2026-10-01",
      titulo: "Preparar material de estudo",
      status: "EM_ANDAMENTO",
      prioridade: "ALTA",
    },
    {
      id: this.nextId++,
      contextoId: 1,
      dataCriacao: "2026-10-01",
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

  async findById(id: number): Promise<Task | null> {
    const task = this.tasks.find((task) => task.id === id);
    return task ? { ...task } : null;
  }

  async create(data: CreateTaskData): Promise<Task> {
    const task: Task = {
      ...data,
      id: this.nextId++,
      dataCriacao: new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Fortaleza",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    };
    this.tasks.push(task);
    return { ...task };
  }

  async update(id: number, data: UpdateTaskInput): Promise<Task | null> {
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
    if (data.contextoId !== undefined) task.contextoId = data.contextoId;

    return { ...task };
  }

  async delete(id: number): Promise<boolean> {
    const index = this.tasks.findIndex((task) => task.id === id);

    if (index === -1) {
      return false;
    }

    this.tasks.splice(index, 1);
    return true;
  }
}

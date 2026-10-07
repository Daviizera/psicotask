import type {
  Context,
  CreateContextData,
  UpdateContextInput,
} from "../types/context.types";
import type { ContextRepository } from "./context.repository";

export class InMemoryContextRepository implements ContextRepository {
  private nextId = 1;

  private contexts: Context[] = [
    { id: this.nextId++, nome: "Administrativo" },
    { id: this.nextId++, nome: "Estudo" },
    { id: this.nextId++, nome: "Supervisão" },
  ];

  async findAll(): Promise<Context[]> {
    return this.contexts.map((context) => ({ ...context }));
  }

  async findById(id: number): Promise<Context | null> {
    const context = this.contexts.find((context) => context.id === id);
    return context ? { ...context } : null;
  }

  async create(data: CreateContextData): Promise<Context> {
    const context: Context = { ...data, id: this.nextId++ };
    this.contexts.push(context);
    return { ...context };
  }

  async update(id: number, data: UpdateContextInput): Promise<Context | null> {
    const context = this.contexts.find((context) => context.id === id);

    if (!context) {
      return null;
    }

    // Campos ausentes ou undefined preservam os valores atuais.
    if (data.nome !== undefined) context.nome = data.nome;
    if (data.descricao !== undefined) context.descricao = data.descricao;

    return { ...context };
  }

  async delete(id: number): Promise<boolean> {
    const index = this.contexts.findIndex((context) => context.id === id);

    if (index === -1) {
      return false;
    }

    this.contexts.splice(index, 1);
    return true;
  }
}

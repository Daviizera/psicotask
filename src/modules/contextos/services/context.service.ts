import type { ContextRepository } from "../repositories/context.repository";
import type {
  Context,
  CreateContextData,
  UpdateContextInput,
} from "../types/context.types";

export class ContextService {
  constructor(private readonly contextRepository: ContextRepository) {}

  findAll(): Promise<Context[]> {
    return this.contextRepository.findAll();
  }

  findById(id: number): Promise<Context | null> {
    return this.contextRepository.findById(id);
  }

  create(data: CreateContextData): Promise<Context> {
    return this.contextRepository.create(data);
  }

  update(id: number, data: UpdateContextInput): Promise<Context | null> {
    return this.contextRepository.update(id, data);
  }

  delete(id: number): Promise<boolean> {
    return this.contextRepository.delete(id);
  }
}

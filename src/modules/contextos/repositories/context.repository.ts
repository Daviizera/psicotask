import type {
  Context,
  CreateContextData,
  UpdateContextInput,
} from "../types/context.types";

export interface ContextRepository {
  findAll(): Promise<Context[]>;
  findById(id: string): Promise<Context | null>;
  create(data: CreateContextData): Promise<Context>;
  update(id: string, data: UpdateContextInput): Promise<Context | null>;
  delete(id: string): Promise<boolean>;
}

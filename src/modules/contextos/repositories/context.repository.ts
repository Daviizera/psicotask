import type {
  Context,
  CreateContextData,
  UpdateContextInput,
} from "../types/context.types";

export interface ContextRepository {
  findAll(): Promise<Context[]>;
  findById(id: number): Promise<Context | null>;
  create(data: CreateContextData): Promise<Context>;
  update(id: number, data: UpdateContextInput): Promise<Context | null>;
  delete(id: number): Promise<boolean>;
}

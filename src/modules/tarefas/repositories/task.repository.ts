import type {
  CreateTaskData,
  Task,
  UpdateTaskInput,
} from "../types/task.types";

export interface TaskRepository {
  findAll(): Promise<Task[]>;
  findById(id: string): Promise<Task | null>;
  create(data: CreateTaskData): Promise<Task>;
  update(id: string, data: UpdateTaskInput): Promise<Task | null>;
  delete(id: string): Promise<boolean>;
}

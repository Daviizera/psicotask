import type {
  CreateTaskData,
  Task,
  TaskFilters,
  UpdateTaskInput,
} from "../types/task.types";

export interface TaskRepository {
  findAll(filters?: TaskFilters): Promise<Task[]>;
  findById(id: string): Promise<Task | null>;
  create(data: CreateTaskData): Promise<Task>;
  update(id: string, data: UpdateTaskInput): Promise<Task | null>;
  delete(id: string): Promise<boolean>;
}

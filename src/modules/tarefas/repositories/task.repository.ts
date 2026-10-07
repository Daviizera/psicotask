import type {
  CreateTaskData,
  Task,
  TaskFilters,
  UpdateTaskInput,
} from "../types/task.types";

export interface TaskRepository {
  findAll(filters?: TaskFilters): Promise<Task[]>;
  findById(id: number): Promise<Task | null>;
  create(data: CreateTaskData): Promise<Task>;
  update(id: number, data: UpdateTaskInput): Promise<Task | null>;
  delete(id: number): Promise<boolean>;
}

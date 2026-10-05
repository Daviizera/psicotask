import type { TaskRepository } from "../repositories/task.repository";
import type {
  CreateTaskData,
  Task,
  TaskFilters,
  UpdateTaskInput,
} from "../types/task.types";

export class TaskService {
  constructor(private readonly taskRepository: TaskRepository) {}

  findAll(filters?: TaskFilters): Promise<Task[]> {
    return this.taskRepository.findAll(filters);
  }

  findById(id: string): Promise<Task | null> {
    return this.taskRepository.findById(id);
  }

  create(data: CreateTaskData): Promise<Task> {
    return this.taskRepository.create(data);
  }

  update(id: string, data: UpdateTaskInput): Promise<Task | null> {
    return this.taskRepository.update(id, data);
  }

  delete(id: string): Promise<boolean> {
    return this.taskRepository.delete(id);
  }
}

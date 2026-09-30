import type { TaskRepository } from "../repositories/task.repository";
import type {
  CreateTaskData,
  Task,
  UpdateTaskInput,
} from "../types/task.types";

export class TaskService {
  constructor(private readonly taskRepository: TaskRepository) {}

  findAll(): Promise<Task[]> {
    return this.taskRepository.findAll();
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

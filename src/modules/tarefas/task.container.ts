import { PrismaTaskRepository } from "./repositories/prisma-task.repository";
import { TaskService } from "./services/task.service";

// O pool é compartilhado pelo singleton em src/lib/prisma.ts.
const taskRepository = new PrismaTaskRepository();

export const taskService = new TaskService(taskRepository);

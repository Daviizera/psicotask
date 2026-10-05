import type { z } from "zod";

import type {
  createTaskSchema,
  taskFiltersSchema,
  taskSchema,
  updateTaskSchema,
} from "../schemas/task.schema";

export type Task = z.output<typeof taskSchema>;
export type TaskStatus = Task["status"];
export type TaskPriority = Task["prioridade"];

// Entrada de criação: status e prioridade podem ser omitidos.
export type CreateTaskInput = z.input<typeof createTaskSchema>;

// Dados após a validação: status e prioridade já possuem valores.
export type CreateTaskData = z.output<typeof createTaskSchema>;

export type UpdateTaskInput = z.input<typeof updateTaskSchema>;
export type TaskFilters = z.output<typeof taskFiltersSchema>;

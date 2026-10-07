import { z } from "zod";

export const taskSchema = z.object({
  id: z.number().int().positive().max(2147483647),
  contextoId: z.number().int().positive().max(2147483647),
  titulo: z
    .string({ error: "O título é obrigatório e deve ser um texto." })
    .trim()
    .min(1, "O título não pode ficar vazio.")
    .max(255, "O título deve ter no máximo 255 caracteres."),
  descricao: z
    .string({ error: "A descrição deve ser um texto." })
    .optional(),
  status: z.enum(["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA"], {
    error: "O status deve ser PENDENTE, EM_ANDAMENTO ou CONCLUIDA.",
  }),
  prioridade: z.enum(["BAIXA", "MEDIA", "ALTA"], {
    error: "A prioridade deve ser BAIXA, MEDIA ou ALTA.",
  }),
  prazo: z
    .iso.date({ error: "O prazo deve ser uma data válida no formato AAAA-MM-DD." })
    .refine((date) => !date.startsWith("0000-"), {
      error: "O ano do prazo deve estar entre 0001 e 9999.",
    })
    .optional(),
  dataCriacao: z.iso.date(),
});

export const taskIdParamSchema = z
  .string()
  .regex(/^[0-9]+$/)
  .transform(Number)
  .pipe(taskSchema.shape.id);

const taskInputSchema = taskSchema.omit({ id: true, dataCriacao: true }).strict();

export const createTaskSchema = taskInputSchema.extend({
  status: taskInputSchema.shape.status.default("PENDENTE"),
  prioridade: taskInputSchema.shape.prioridade.default("MEDIA"),
});

// O PUT parcial não aplica os valores padrão usados na criação.
export const updateTaskSchema = taskInputSchema.partial().refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  { error: "Informe ao menos um campo da tarefa para atualizar." },
);

export const taskFiltersSchema = taskSchema
  .pick({ status: true, prioridade: true, prazo: true })
  .partial();

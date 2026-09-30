import { z } from "zod";

export const taskSchema = z.object({
  id: z.string(),
  titulo: z
    .string({ error: "O título é obrigatório e deve ser um texto." })
    .trim()
    .min(1, "O título não pode ficar vazio."),
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
    .optional(),
});

const taskInputSchema = taskSchema.omit({ id: true });

export const createTaskSchema = taskInputSchema.extend({
  status: taskInputSchema.shape.status.default("PENDENTE"),
  prioridade: taskInputSchema.shape.prioridade.default("MEDIA"),
});

// O PUT parcial não aplica os valores padrão usados na criação.
export const updateTaskSchema = taskInputSchema.partial();

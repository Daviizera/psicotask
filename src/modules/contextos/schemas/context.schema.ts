import { z } from "zod";

export const contextSchema = z.object({
  id: z.string(),
  nome: z
    .string({ error: "O nome é obrigatório e deve ser um texto." })
    .trim()
    .min(1, "O nome não pode ficar vazio."),
  descricao: z
    .string({ error: "A descrição deve ser um texto." })
    .optional(),
});

export const createContextSchema = contextSchema.omit({ id: true });

export const updateContextSchema = createContextSchema.partial().refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  { error: "Informe ao menos um campo do contexto para atualizar." },
);

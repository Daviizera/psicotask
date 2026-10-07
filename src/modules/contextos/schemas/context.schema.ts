import { z } from "zod";

export const contextSchema = z.object({
  id: z.number().int().positive().max(2147483647),
  nome: z
    .string({ error: "O nome é obrigatório e deve ser um texto." })
    .trim()
    .min(1, "O nome não pode ficar vazio.")
    .max(200, "O nome deve ter no máximo 200 caracteres."),
  descricao: z
    .string({ error: "A descrição deve ser um texto." })
    .optional(),
});

// O parâmetro HTTP é texto; só aceita dígitos antes de converter para INTEGER.
export const contextIdParamSchema = z
  .string()
  .regex(/^[0-9]+$/)
  .transform(Number)
  .pipe(contextSchema.shape.id);

export const createContextSchema = contextSchema.omit({ id: true }).strict();

export const updateContextSchema = createContextSchema.partial().refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  { error: "Informe ao menos um campo do contexto para atualizar." },
);

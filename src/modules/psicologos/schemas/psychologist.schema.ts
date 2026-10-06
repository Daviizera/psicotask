import { z } from "zod";

export const psychologistSchema = z.object({
  id: z.number().int().positive(),
  nome: z
    .string({ error: "O nome é obrigatório e deve ser um texto." })
    .trim()
    .min(1, "O nome não pode ficar vazio."),
  email: z.email({ error: "O e-mail deve ser válido." }),
  registroProfissional: z
    .string({ error: "O registro profissional é obrigatório e deve ser um texto." })
    .trim()
    .min(1, "O registro profissional não pode ficar vazio."),
});

export const updatePsychologistSchema = psychologistSchema
  .omit({ id: true })
  .partial()
  .strict()
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { error: "Informe ao menos um campo do perfil para atualizar." },
  );

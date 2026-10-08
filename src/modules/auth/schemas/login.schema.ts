import { z } from "zod";

export const loginSchema = z.object({
  email: z.email({ error: "O e-mail deve ser válido." }).max(254),
  // Espaços fazem parte da senha: não aplicar trim ou outra normalização.
  senha: z.string({ error: "A senha é obrigatória." })
    .min(1, "A senha é obrigatória.")
    .max(1024, "A senha excede o tamanho permitido."),
}).strict();

export type LoginInput = z.output<typeof loginSchema>;

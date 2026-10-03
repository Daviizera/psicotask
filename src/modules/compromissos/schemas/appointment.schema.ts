import { z } from "zod";

export const appointmentSchema = z.object({
  id: z.string(),
  titulo: z
    .string({ error: "O título é obrigatório e deve ser um texto." })
    .trim()
    .min(1, "O título não pode ficar vazio."),
  descricao: z
    .string({ error: "A descrição deve ser um texto." })
    .optional(),
  data: z.iso.date({ error: "A data deve ser válida e estar no formato AAAA-MM-DD." }),
  horaInicio: z.iso.time({
    precision: -1,
    error: "A hora de início deve ser válida e estar no formato HH:mm.",
  }),
  horaFim: z.iso.time({
    precision: -1,
    error: "A hora de término deve ser válida e estar no formato HH:mm.",
  }),
  status: z.enum(["AGENDADO", "CONCLUIDO", "CANCELADO"], {
    error: "O status deve ser AGENDADO, CONCLUIDO ou CANCELADO.",
  }),
});

const appointmentInputSchema = appointmentSchema.omit({ id: true });

export const createAppointmentSchema = appointmentInputSchema.extend({
  status: appointmentInputSchema.shape.status.default("AGENDADO"),
});

// O PUT parcial não aplica o status padrão usado na criação.
export const updateAppointmentSchema = appointmentInputSchema.partial().refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  { error: "Informe ao menos um campo do compromisso para atualizar." },
);

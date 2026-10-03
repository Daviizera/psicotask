import type { z } from "zod";

import type {
  psychologistSchema,
  updatePsychologistSchema,
} from "../schemas/psychologist.schema";

export type Psychologist = z.output<typeof psychologistSchema>;
export type UpdatePsychologistInput = z.input<typeof updatePsychologistSchema>;

import type { z } from "zod";

import type {
  contextSchema,
  createContextSchema,
  updateContextSchema,
} from "../schemas/context.schema";

export type Context = z.output<typeof contextSchema>;
export type CreateContextInput = z.input<typeof createContextSchema>;
export type CreateContextData = z.output<typeof createContextSchema>;
export type UpdateContextInput = z.input<typeof updateContextSchema>;

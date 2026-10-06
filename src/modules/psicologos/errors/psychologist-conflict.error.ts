export const PSYCHOLOGIST_CONFLICT = "PSYCHOLOGIST_CONFLICT";

export class PsychologistConflictError extends Error {
  readonly code = PSYCHOLOGIST_CONFLICT;

  constructor() {
    super("E-mail ou registro profissional já cadastrado.");
    this.name = "PsychologistConflictError";
  }
}

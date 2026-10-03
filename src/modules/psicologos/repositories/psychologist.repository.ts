import type {
  Psychologist,
  UpdatePsychologistInput,
} from "../types/psychologist.types";

export interface PsychologistRepository {
  findCurrent(): Promise<Psychologist>;
  update(data: UpdatePsychologistInput): Promise<Psychologist>;
}

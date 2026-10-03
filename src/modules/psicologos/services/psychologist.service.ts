import type { PsychologistRepository } from "../repositories/psychologist.repository";
import type {
  Psychologist,
  UpdatePsychologistInput,
} from "../types/psychologist.types";

export class PsychologistService {
  constructor(private readonly psychologistRepository: PsychologistRepository) {}

  findCurrent(): Promise<Psychologist> {
    return this.psychologistRepository.findCurrent();
  }

  update(data: UpdatePsychologistInput): Promise<Psychologist> {
    return this.psychologistRepository.update(data);
  }
}

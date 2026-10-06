import { randomInt } from "node:crypto";

import type {
  Psychologist,
  UpdatePsychologistInput,
} from "../types/psychologist.types";
import type { PsychologistRepository } from "./psychologist.repository";

export class InMemoryPsychologistRepository implements PsychologistRepository {
  private psychologist: Psychologist = {
    id: randomInt(1, 2147483647),
    nome: "Psicólogo de demonstração",
    email: "psicologo@example.com",
    registroProfissional: "DEMO-0000",
  };

  async findCurrent(): Promise<Psychologist> {
    return { ...this.psychologist };
  }

  async update(data: UpdatePsychologistInput): Promise<Psychologist> {
    // Atualiza somente os campos do perfil, preservando o ID e valores omitidos.
    if (data.nome !== undefined) this.psychologist.nome = data.nome;
    if (data.email !== undefined) this.psychologist.email = data.email;
    if (data.registroProfissional !== undefined) {
      this.psychologist.registroProfissional = data.registroProfissional;
    }

    return { ...this.psychologist };
  }
}

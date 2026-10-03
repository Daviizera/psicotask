import { InMemoryPsychologistRepository } from "./repositories/in-memory-psychologist.repository";
import { PsychologistService } from "./services/psychologist.service";

// Persistência temporária da pré-validação: mantém um único perfil compartilhado
// no mesmo contexto global, inclusive ao reavaliar módulos em desenvolvimento.
// Os dados são perdidos ao reiniciar e não são compartilhados entre processos.
const globalForPsychologists = globalThis as typeof globalThis & {
  psicoPsychologistRepository?: InMemoryPsychologistRepository;
  psicoPsychologistService?: PsychologistService;
};

const psychologistRepository = (globalForPsychologists.psicoPsychologistRepository ??=
  new InMemoryPsychologistRepository());

export const psychologistService = (globalForPsychologists.psicoPsychologistService ??=
  new PsychologistService(psychologistRepository));

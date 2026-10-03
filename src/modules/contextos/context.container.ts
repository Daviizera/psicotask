import { InMemoryContextRepository } from "./repositories/in-memory-context.repository";
import { ContextService } from "./services/context.service";

// Persistência temporária da pré-validação: compartilha as instâncias entre as
// rotas no mesmo contexto global, inclusive ao reavaliar módulos em desenvolvimento.
// Os dados são perdidos ao reiniciar e não são compartilhados entre processos.
const globalForContexts = globalThis as typeof globalThis & {
  psicoContextRepository?: InMemoryContextRepository;
  psicoContextService?: ContextService;
};

const contextRepository = (globalForContexts.psicoContextRepository ??=
  new InMemoryContextRepository());

export const contextService = (globalForContexts.psicoContextService ??=
  new ContextService(contextRepository));

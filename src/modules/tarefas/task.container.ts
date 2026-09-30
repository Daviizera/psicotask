import { InMemoryTaskRepository } from "./repositories/in-memory-task.repository";
import { TaskService } from "./services/task.service";

// Persistência temporária da pré-validação: compartilha as instâncias entre as
// rotas no mesmo contexto global, inclusive ao reavaliar módulos em desenvolvimento.
// Os dados são perdidos ao reiniciar e não são compartilhados entre processos.
const globalForTasks = globalThis as typeof globalThis & {
  psicoTaskRepository?: InMemoryTaskRepository;
  psicoTaskService?: TaskService;
};

const taskRepository = (globalForTasks.psicoTaskRepository ??=
  new InMemoryTaskRepository());

export const taskService = (globalForTasks.psicoTaskService ??=
  new TaskService(taskRepository));

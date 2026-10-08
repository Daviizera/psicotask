export const CONTEXT_HAS_TASKS = "CONTEXT_HAS_TASKS";

export class ContextHasTasksError extends Error {
  readonly code = CONTEXT_HAS_TASKS;

  constructor() {
    super("Não é possível excluir um contexto que possui tarefas vinculadas.");
    this.name = "ContextHasTasksError";
  }
}

export class TaskContextNotFoundError extends Error {
  constructor() {
    super("Contexto não encontrado");
    this.name = "TaskContextNotFoundError";
  }
}

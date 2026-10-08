export const AUTHENTICATION_REQUIRED = "AUTHENTICATION_REQUIRED";

export class AuthenticationError extends Error {
  readonly code = AUTHENTICATION_REQUIRED;

  constructor() {
    super("Não autenticado");
    this.name = "AuthenticationError";
  }
}

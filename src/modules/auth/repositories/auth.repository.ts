import type { Psychologist } from "../../psicologos/types/psychologist.types";

// Credenciais são internas ao fluxo de autenticação e nunca retornam pela API.
export type AuthCredentials = { id: number; senhaHash: string };

export interface AuthRepository {
  findCredentialsByEmail(email: string): Promise<AuthCredentials | null>;
  findPublicById(id: number): Promise<Psychologist | null>;
}

import { verifyPassword } from "@/lib/auth/password";
import type { Psychologist } from "../../psicologos/types/psychologist.types";
import type { AuthRepository } from "../repositories/auth.repository";
import type { LoginInput } from "../schemas/login.schema";

export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  async authenticate(data: LoginInput): Promise<Psychologist | null> {
    const credentials = await this.authRepository.findCredentialsByEmail(data.email);
    const valid = await verifyPassword(data.senha, credentials?.senhaHash ?? null);
    if (!credentials || !valid) return null;
    return this.authRepository.findPublicById(credentials.id);
  }

  findCurrent(psicologoId: number): Promise<Psychologist | null> {
    return this.authRepository.findPublicById(psicologoId);
  }
}

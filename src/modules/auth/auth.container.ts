import { PrismaAuthRepository } from "./repositories/prisma-auth.repository";
import { AuthService } from "./services/auth.service";

export const authService = new AuthService(new PrismaAuthRepository());

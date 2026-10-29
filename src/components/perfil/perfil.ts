import type { Psychologist } from "@/modules/psicologos/types/psychologist.types";

// Limites físicos das colunas em prisma/schema.prisma. O schema Zod de Perfil
// ainda não os valida (docs/frontend-handoff.md): excedê-los resultaria em 500.
export const LIMITES = {
  nome: 200,
  email: 254,
  registroProfissional: 50,
} as const;

export const MENSAGENS = {
  validacao: "Verifique os dados informados.",
  origem:
    "Não foi possível validar a origem da requisição. Recarregue a página e tente novamente.",
  servidor: "Ocorreu um erro inesperado. Tente novamente em instantes.",
  rede: "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
} as const;

export function ehPerfil(valor: unknown): valor is Psychologist {
  if (typeof valor !== "object" || valor === null) return false;
  const { id, nome, email, registroProfissional } = valor as Record<string, unknown>;
  return (
    typeof id === "number" &&
    typeof nome === "string" &&
    typeof email === "string" &&
    typeof registroProfissional === "string"
  );
}

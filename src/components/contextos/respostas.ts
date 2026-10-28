import type { Context } from "@/modules/contextos/types/context.types";

// Limite de `nome` definido em src/modules/contextos/schemas/context.schema.ts.
export const NOME_MAX = 200;

export const MENSAGENS = {
  validacao: "Verifique os dados informados.",
  origem:
    "Não foi possível validar a origem da requisição. Recarregue a página e tente novamente.",
  naoEncontrado: "Este contexto não foi encontrado. Ele pode já ter sido removido.",
  servidor: "Ocorreu um erro inesperado. Tente novamente em instantes.",
  rede: "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
} as const;

// Corpo de erro documentado em docs/frontend-handoff.md: { error, details? }.
export type CorpoDeErro = {
  error?: unknown;
  details?: unknown;
};

export async function lerCorpoDeErro(response: Response): Promise<CorpoDeErro> {
  try {
    const corpo: unknown = await response.json();
    return typeof corpo === "object" && corpo !== null ? (corpo as CorpoDeErro) : {};
  } catch {
    return {};
  }
}

export function ehContexto(valor: unknown): valor is Context {
  if (typeof valor !== "object" || valor === null) return false;
  const { id, nome, descricao } = valor as Record<string, unknown>;
  return (
    typeof id === "number" &&
    typeof nome === "string" &&
    (descricao === undefined || typeof descricao === "string")
  );
}

// A API não garante ordem: nome crescente e, em empate, ID crescente.
const comparadorDeNomes = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

export function ordenarContextos(contextos: Context[]): Context[] {
  return [...contextos].sort(
    (a, b) => comparadorDeNomes.compare(a.nome, b.nome) || a.id - b.id,
  );
}

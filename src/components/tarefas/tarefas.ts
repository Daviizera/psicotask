import type { Task, TaskPriority, TaskStatus } from "@/modules/tarefas/types/task.types";

// Limite de `titulo` definido em src/modules/tarefas/schemas/task.schema.ts.
export const TITULO_MAX = 255;

// Ordem das colunas do Kanban.
export const STATUS: readonly TaskStatus[] = ["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA"];

// Ordem de exibição no formulário, da menor para a maior.
export const PRIORIDADES: readonly TaskPriority[] = ["BAIXA", "MEDIA", "ALTA"];

export const ROTULOS_STATUS: Record<TaskStatus, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
};

export const ROTULOS_PRIORIDADE: Record<TaskPriority, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
};

// Movimentos oferecidos no card; cada um é um PUT com { status: destino }.
export const TRANSICOES: Record<
  TaskStatus,
  readonly { destino: TaskStatus; rotulo: string; sentido: "voltar" | "avancar" }[]
> = {
  PENDENTE: [{ destino: "EM_ANDAMENTO", rotulo: "Iniciar", sentido: "avancar" }],
  EM_ANDAMENTO: [
    { destino: "PENDENTE", rotulo: "Voltar", sentido: "voltar" },
    { destino: "CONCLUIDA", rotulo: "Concluir", sentido: "avancar" },
  ],
  CONCLUIDA: [{ destino: "EM_ANDAMENTO", rotulo: "Reabrir", sentido: "voltar" }],
};

export const MENSAGENS = {
  validacao: "Verifique os dados informados.",
  origem:
    "Não foi possível validar a origem da requisição. Recarregue a página e tente novamente.",
  naoEncontrada: "Esta tarefa não foi encontrada. Ela pode já ter sido removida.",
  contextoNaoEncontrado:
    "O contexto selecionado não foi encontrado. Ele pode ter sido removido; escolha outro.",
  servidor: "Ocorreu um erro inesperado. Tente novamente em instantes.",
  rede: "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
} as const;

// Mensagens documentadas em docs/frontend-handoff.md para o 404 de PUT /api/tarefas/:id.
export const ERRO_CONTEXTO_NAO_ENCONTRADO = "Contexto não encontrado";

const PADRAO_DATA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;

// Data civil YYYY-MM-DD com ano entre 0001 e 9999, como exige o schema.
export function ehDataCivil(valor: unknown): valor is string {
  return typeof valor === "string" && PADRAO_DATA_CIVIL.test(valor) && !valor.startsWith("0000-");
}

function ehStatus(valor: unknown): valor is TaskStatus {
  return typeof valor === "string" && (STATUS as readonly string[]).includes(valor);
}

function ehPrioridade(valor: unknown): valor is TaskPriority {
  return typeof valor === "string" && (PRIORIDADES as readonly string[]).includes(valor);
}

export function ehTarefa(valor: unknown): valor is Task {
  if (typeof valor !== "object" || valor === null) return false;
  const { id, contextoId, titulo, descricao, status, prioridade, prazo, dataCriacao } =
    valor as Record<string, unknown>;
  return (
    typeof id === "number" &&
    typeof contextoId === "number" &&
    typeof titulo === "string" &&
    (descricao === undefined || typeof descricao === "string") &&
    ehStatus(status) &&
    ehPrioridade(prioridade) &&
    (prazo === undefined || ehDataCivil(prazo)) &&
    ehDataCivil(dataCriacao)
  );
}

// A API não garante ordem. Em cada coluna: prioridade (alta primeiro), prazo
// mais próximo (sem prazo por último), título e, em empate, ID.
const PESO_PRIORIDADE: Record<TaskPriority, number> = { ALTA: 0, MEDIA: 1, BAIXA: 2 };
const comparadorDeTitulos = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

// Strings YYYY-MM-DD comparam cronologicamente sem conversão para Date.
function compararPrazos(a: string | undefined, b: string | undefined): number {
  if (a === b) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return a < b ? -1 : 1;
}

function compararTarefas(a: Task, b: Task): number {
  return (
    PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade] ||
    compararPrazos(a.prazo, b.prazo) ||
    comparadorDeTitulos.compare(a.titulo, b.titulo) ||
    a.id - b.id
  );
}

export function agruparPorStatus(tarefas: Task[]): Record<TaskStatus, Task[]> {
  const colunas: Record<TaskStatus, Task[]> = { PENDENTE: [], EM_ANDAMENTO: [], CONCLUIDA: [] };
  for (const tarefa of tarefas) colunas[tarefa.status].push(tarefa);
  for (const status of STATUS) colunas[status].sort(compararTarefas);
  return colunas;
}

// Datas YYYY-MM-DD são civis. "20/10/2026" é montado direto da string, e o
// formato longo usa UTC nas duas pontas, para que o fuso do navegador nunca
// desloque o dia.
export function formatarDataCurta(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

const formatoDataLonga = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatarDataLonga(data: string): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const civil = new Date(0);
  civil.setUTCFullYear(ano, mes - 1, dia);
  return formatoDataLonga.format(civil);
}

// Mesmo fuso usado pelo backend para definir o "dia atual" da rotina.
const FUSO_DA_ROTINA = "America/Fortaleza";

export function hojeNaRotina(): string {
  // en-CA produz YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_DA_ROTINA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

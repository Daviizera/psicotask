export type Contexto = { id: number; nome: string; descricao?: string };
export type Status = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA';
export type Prioridade = 'BAIXA' | 'MEDIA' | 'ALTA';
export type Tarefa = { id: number; contextoId: number; titulo: string; descricao?: string; status: Status; prioridade: Prioridade; prazo?: string; dataCriacao: string };
export type Compromisso = { id: number; titulo: string; descricao?: string; data: string; horaInicio: string; horaFim: string; status: string };
export type Perfil = { id: number; nome: string; email: string; registroProfissional: string };
export type Resumo = { tarefasPendentes: number; tarefasPrioritarias: number; proximosCompromissos: Compromisso[] };

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: { path: (string | number)[]; message: string }[]) { super(message); }
}
export async function api<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const r = await fetch(url, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 204) return undefined as T;
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.includes('/auth/login') && typeof window !== 'undefined') window.location.href = '/login';
  if (!r.ok) throw new ApiError(r.status, j.error ?? 'Erro inesperado', j.details);
  return j as T;
}
export const msg = (e: unknown) => (e instanceof ApiError ? e.details?.map((d) => d.message).join(' ') || e.message : 'Erro inesperado');
// A API de Contexto não tem cor: derivamos uma cor estável a partir do id.
const CORES = ['#2e9e5b', '#8b5cf6', '#e0a800', '#3b82f6', '#e11d48', '#0891b2'];
export const corDe = (id: number) => CORES[id % CORES.length];
export const fmt = (d?: string) => (d ? d.split('-').reverse().join('/') : '');
export const STATUS: Record<Status, string> = { PENDENTE: 'A Fazer', EM_ANDAMENTO: 'Em Andamento', CONCLUIDA: 'Concluídas' };
export const PRIO: Record<Prioridade, string> = { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta' };

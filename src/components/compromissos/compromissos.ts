import type {
  Appointment,
  AppointmentStatus,
} from "@/modules/compromissos/types/appointment.types";

// Limite de `titulo` definido em src/modules/compromissos/schemas/appointment.schema.ts.
export const TITULO_MAX = 255;

export const STATUS: readonly AppointmentStatus[] = ["AGENDADO", "CONCLUIDO", "CANCELADO"];

export const ROTULOS_STATUS: Record<AppointmentStatus, string> = {
  AGENDADO: "Agendado",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

export const MENSAGENS = {
  validacao: "Verifique os dados informados.",
  origem:
    "Não foi possível validar a origem da requisição. Recarregue a página e tente novamente.",
  naoEncontrado: "Este compromisso não foi encontrado. Ele pode já ter sido removido.",
  servidor: "Ocorreu um erro inesperado. Tente novamente em instantes.",
  rede: "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
} as const;

// Mesma mensagem usada pelo backend para o intervalo inválido.
export const MENSAGEM_INTERVALO_INVALIDO = "A hora de término deve ser posterior à hora de início.";

const PADRAO_DATA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;
// HH:mm em 24 horas, sem segundos, como exige `z.iso.time({ precision: -1 })`.
const PADRAO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

// Data civil YYYY-MM-DD com ano entre 0001 e 9999, como exige o schema.
export function ehDataCivil(valor: unknown): valor is string {
  return typeof valor === "string" && PADRAO_DATA_CIVIL.test(valor) && !valor.startsWith("0000-");
}

export function ehHora(valor: unknown): valor is string {
  return typeof valor === "string" && PADRAO_HORA.test(valor);
}

function ehStatus(valor: unknown): valor is AppointmentStatus {
  return typeof valor === "string" && (STATUS as readonly string[]).includes(valor);
}

export function ehCompromisso(valor: unknown): valor is Appointment {
  if (typeof valor !== "object" || valor === null) return false;
  const { id, titulo, descricao, data, horaInicio, horaFim, status } = valor as Record<
    string,
    unknown
  >;
  return (
    typeof id === "number" &&
    typeof titulo === "string" &&
    (descricao === undefined || typeof descricao === "string") &&
    ehDataCivil(data) &&
    ehHora(horaInicio) &&
    ehHora(horaFim) &&
    ehStatus(status)
  );
}

export type DiaDaAgenda = { data: string; compromissos: Appointment[] };

const comparadorDeTitulos = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

// Strings YYYY-MM-DD e HH:mm comparam cronologicamente sem conversão para Date.
function compararDentroDoDia(a: Appointment, b: Appointment): number {
  if (a.horaInicio !== b.horaInicio) return a.horaInicio < b.horaInicio ? -1 : 1;
  return comparadorDeTitulos.compare(a.titulo, b.titulo) || a.id - b.id;
}

// A API não garante ordem. Agrupa por data; dentro do dia, hora de início,
// título e ID. `hoje` em diante fica em ordem crescente (o mais próximo
// primeiro); datas anteriores, do mais recente para o mais antigo.
export function montarAgenda(
  compromissos: Appointment[],
  hoje: string,
): { proximos: DiaDaAgenda[]; anteriores: DiaDaAgenda[] } {
  const porData = new Map<string, Appointment[]>();
  for (const compromisso of compromissos) {
    const dia = porData.get(compromisso.data);
    if (dia) dia.push(compromisso);
    else porData.set(compromisso.data, [compromisso]);
  }

  const dias: DiaDaAgenda[] = [...porData.entries()].map(([data, itens]) => ({
    data,
    compromissos: itens.sort(compararDentroDoDia),
  }));

  return {
    proximos: dias.filter((dia) => dia.data >= hoje).sort((a, b) => (a.data < b.data ? -1 : 1)),
    anteriores: dias.filter((dia) => dia.data < hoje).sort((a, b) => (a.data < b.data ? 1 : -1)),
  };
}

// Datas YYYY-MM-DD são civis: montadas em UTC e formatadas em UTC, para que o
// fuso do navegador nunca desloque o dia. Mesma abordagem do Resumo e de
// Tarefas, mantida aqui para não acoplar Compromissos a esses módulos.
function dataCivil(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  const civil = new Date(0);
  // setUTCFullYear preserva anos de 0001 a 0099, ao contrário de Date.UTC.
  civil.setUTCFullYear(ano, mes - 1, dia);
  return civil;
}

const formatoDia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: "UTC" });
const formatoMes = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
const formatoDataLonga = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function partesDaData(data: string): { dia: string; mes: string; extenso: string } {
  const civil = dataCivil(data);
  return {
    dia: formatoDia.format(civil),
    // Ex.: "out". O ponto final da abreviação do mês é removido.
    mes: formatoMes.format(civil).replace(".", ""),
    extenso: formatoDataLonga.format(civil),
  };
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

const formatoAgora = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_DA_ROTINA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  // h23 evita "24:00" à meia-noite.
  hourCycle: "h23",
});

export type AgoraNaRotina = { data: string; hora: string };

// Data (YYYY-MM-DD) e hora (HH:mm) atuais no fuso da rotina, lidas do mesmo
// instante para que não divirjam na virada do dia.
export function agoraNaRotina(): AgoraNaRotina {
  const partes = Object.fromEntries(
    formatoAgora.formatToParts(new Date()).map(({ type, value }) => [type, value]),
  );
  return {
    data: `${partes.year}-${partes.month}-${partes.day}`,
    hora: `${partes.hour}:${partes.minute}`,
  };
}

// Indicação apenas visual: o status persistido nunca é alterado por ela.
// Strings YYYY-MM-DD e HH:mm comparam cronologicamente sem conversão para Date.
export function estaEmAtraso(compromisso: Appointment, agora: AgoraNaRotina): boolean {
  if (compromisso.status !== "AGENDADO") return false;
  if (compromisso.data < agora.data) return true;
  return compromisso.data === agora.data && compromisso.horaFim < agora.hora;
}

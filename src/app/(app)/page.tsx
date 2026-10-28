"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { usePsicologoAutenticado } from "@/components/app-shell";
import type { Appointment } from "@/modules/compromissos/types/appointment.types";
import type { RoutineSummary } from "@/modules/resumo/types/routine-summary.types";

type EstadoDoResumo =
  | { tipo: "carregando" }
  | { tipo: "sucesso"; resumo: RoutineSummary }
  | { tipo: "erro"; mensagem: string };

const MENSAGENS = {
  servidor: "Não foi possível carregar o resumo. Tente novamente em instantes.",
  rede: "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
} as const;

// Mesmo fuso usado pelo backend para definir o "dia atual" dos compromissos.
const FUSO_DA_ROTINA = "America/Fortaleza";

function ehResumo(valor: unknown): valor is RoutineSummary {
  if (typeof valor !== "object" || valor === null) return false;
  const { tarefasPendentes, tarefasPrioritarias, proximosCompromissos } =
    valor as Record<string, unknown>;
  return (
    typeof tarefasPendentes === "number" &&
    typeof tarefasPrioritarias === "number" &&
    Array.isArray(proximosCompromissos)
  );
}

// Datas YYYY-MM-DD são civis: montadas em UTC e formatadas em UTC para que o
// fuso do navegador nunca desloque o dia.
function dataCivil(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

const formatoDia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: "UTC" });
const formatoMes = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
const formatoDataLonga = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

// Ex.: "20 out". O ponto final da abreviação do mês é removido.
function mesAbreviado(data: Date): string {
  return formatoMes.format(data).replace(".", "");
}

function dataCurta(data: string): string {
  const civil = dataCivil(data);
  return `${formatoDia.format(civil)} ${mesAbreviado(civil)}`;
}

function hojeNaRotina(): string {
  // en-CA produz YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_DA_ROTINA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? "";
}

export default function ResumoPage() {
  const router = useRouter();
  const psicologo = usePsicologoAutenticado();
  const [estado, setEstado] = useState<EstadoDoResumo>({ tipo: "carregando" });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/resumo", { credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) {
          setEstado({ tipo: "erro", mensagem: MENSAGENS.servidor });
          return;
        }
        const corpo: unknown = await response.json();
        setEstado(
          ehResumo(corpo)
            ? { tipo: "sucesso", resumo: corpo }
            : { tipo: "erro", mensagem: MENSAGENS.servidor },
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setEstado({ tipo: "erro", mensagem: MENSAGENS.rede });
      });
    return () => controller.abort();
  }, [router, tentativa]);

  function tentarNovamente() {
    setEstado({ tipo: "carregando" });
    setTentativa((valor) => valor + 1);
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        {psicologo && (
          <p className="text-body-md text-on-surface-variant">
            Olá, {primeiroNome(psicologo.nome)}.
          </p>
        )}
        <h1 className="text-headline-lg-mobile text-on-surface sm:text-headline-lg">
          Resumo da rotina
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Uma visão rápida das suas tarefas em aberto e dos próximos compromissos.
        </p>
      </header>

      {estado.tipo === "carregando" && <ResumoCarregando />}

      {estado.tipo === "erro" && (
        <div
          role="alert"
          className="flex flex-col gap-4 rounded-card border border-error/30 bg-error-container p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="flex items-start gap-2.5 text-body-md text-error">
            <IconeAlerta />
            <span>{estado.mensagem}</span>
          </p>
          <button
            type="button"
            onClick={tentarNovamente}
            className="shrink-0 rounded-control border border-error/30 bg-surface-container-lowest px-4 py-2 text-label-lg text-error transition-colors hover:bg-surface-container-low"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {estado.tipo === "sucesso" && <ResumoCarregado resumo={estado.resumo} />}
    </div>
  );
}

function ResumoCarregado({ resumo }: Readonly<{ resumo: RoutineSummary }>) {
  const hoje = hojeNaRotina();
  const proximo = resumo.proximosCompromissos[0];

  return (
    <>
      <section aria-label="Indicadores da rotina" className="grid gap-4 sm:grid-cols-3">
        <CartaoMetrica
          icone={<IconeTarefas />}
          classeIcone="bg-primary-fixed/60 text-primary"
          rotulo="Tarefas pendentes"
          valor={String(resumo.tarefasPendentes)}
          descricao="Com status Pendente"
        />
        <CartaoMetrica
          icone={<IconePrioridade />}
          classeIcone="bg-error-container/70 text-error"
          rotulo="Prioridade alta"
          valor={String(resumo.tarefasPrioritarias)}
          descricao="Tarefas de prioridade alta ainda não concluídas"
        />
        <CartaoMetrica
          icone={<IconeCalendario />}
          classeIcone="bg-tertiary-fixed/60 text-tertiary"
          rotulo="Próximo compromisso"
          valor={
            proximo
              ? `${proximo.data === hoje ? "Hoje" : dataCurta(proximo.data)}, ${proximo.horaInicio}`
              : "Nenhum"
          }
          descricao={proximo ? proximo.titulo : "Nenhum compromisso agendado a partir de hoje"}
          valorCompacto
        />
      </section>

      <section
        aria-labelledby="proximos-compromissos-titulo"
        className="rounded-card border border-outline-variant/40 bg-surface-container-lowest shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-outline-variant/30 px-5 py-4">
          <h2 id="proximos-compromissos-titulo" className="text-headline-sm text-on-surface">
            Próximos compromissos
          </h2>
          {resumo.proximosCompromissos.length > 0 && (
            <span className="rounded-pill bg-surface-container px-2.5 py-0.5 text-label-md text-on-surface-variant">
              {resumo.proximosCompromissos.length}
            </span>
          )}
        </div>

        {resumo.proximosCompromissos.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-pill bg-surface-container-low text-outline">
              <IconeCalendario />
            </span>
            <p className="text-label-lg text-on-surface">Nenhum compromisso agendado</p>
            <p className="max-w-sm text-body-md text-on-surface-variant">
              Compromissos agendados a partir de hoje aparecerão aqui.
            </p>
          </div>
        ) : (
          // Ordem preservada da API: data e depois horário de início, crescentes.
          <ul className="divide-y divide-outline-variant/30">
            {resumo.proximosCompromissos.map((compromisso) => (
              <ItemCompromisso
                key={compromisso.id}
                compromisso={compromisso}
                ehHoje={compromisso.data === hoje}
              />
            ))}
          </ul>
        )}

        {resumo.proximosCompromissos.length > 0 && (
          <p className="border-t border-outline-variant/30 px-5 py-3 text-body-sm text-on-surface-variant">
            Exibindo até 5 compromissos agendados, a partir de hoje.
          </p>
        )}
      </section>
    </>
  );
}

function CartaoMetrica({
  icone,
  classeIcone,
  rotulo,
  valor,
  descricao,
  valorCompacto = false,
}: Readonly<{
  icone: ReactNode;
  classeIcone: string;
  rotulo: string;
  valor: string;
  descricao: string;
  valorCompacto?: boolean;
}>) {
  return (
    <div className="flex min-w-0 items-start gap-4 rounded-card border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]">
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-control ${classeIcone}`}
      >
        {icone}
      </span>
      <div className="min-w-0 space-y-1">
        <p className="text-label-md text-on-surface-variant">{rotulo}</p>
        <p
          className={`text-on-surface ${valorCompacto ? "text-headline-sm" : "text-headline-lg"}`}
        >
          {valor}
        </p>
        <p className="line-clamp-2 break-words text-body-sm text-on-surface-variant">
          {descricao}
        </p>
      </div>
    </div>
  );
}

function ItemCompromisso({
  compromisso,
  ehHoje,
}: Readonly<{ compromisso: Appointment; ehHoje: boolean }>) {
  const data = dataCivil(compromisso.data);

  return (
    <li className="flex gap-4 px-5 py-4">
      <div
        aria-hidden="true"
        className={`flex w-14 shrink-0 flex-col items-center justify-center rounded-control py-2 ${
          ehHoje ? "bg-primary-container text-on-primary" : "bg-surface-container-low text-primary"
        }`}
      >
        <span className="text-headline-sm leading-none">{formatoDia.format(data)}</span>
        <span className="mt-1 text-label-sm uppercase">
          {mesAbreviado(data)}
        </span>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="min-w-0 break-words text-label-lg text-on-surface">
            {compromisso.titulo}
          </h3>
          {ehHoje && (
            <span className="rounded-pill bg-tertiary-fixed px-2 py-0.5 text-label-sm text-tertiary">
              Hoje
            </span>
          )}
        </div>
        <p className="flex flex-wrap items-center gap-x-2 text-body-sm text-on-surface-variant">
          <span className="first-letter:uppercase">{formatoDataLonga.format(data)}</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            <IconeRelogio />
            {compromisso.horaInicio}–{compromisso.horaFim}
          </span>
        </p>
        {compromisso.descricao && (
          <p className="line-clamp-2 break-words text-body-sm text-on-surface-variant">
            {compromisso.descricao}
          </p>
        )}
      </div>
    </li>
  );
}

function ResumoCarregando() {
  return (
    <div aria-busy="true" className="space-y-8">
      <p role="status" className="sr-only">
        Carregando resumo…
      </p>
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((indice) => (
          <div
            key={indice}
            className="flex gap-4 rounded-card border border-outline-variant/40 bg-surface-container-lowest p-5"
          >
            <span className="size-10 shrink-0 animate-pulse rounded-control bg-surface-container" />
            <span className="flex-1 space-y-2.5">
              <span className="block h-3 w-24 animate-pulse rounded-pill bg-surface-container" />
              <span className="block h-7 w-12 animate-pulse rounded-pill bg-surface-container" />
              <span className="block h-3 w-32 animate-pulse rounded-pill bg-surface-container-low" />
            </span>
          </div>
        ))}
      </div>
      <div
        aria-hidden="true"
        className="space-y-4 rounded-card border border-outline-variant/40 bg-surface-container-lowest p-5"
      >
        <span className="block h-5 w-48 animate-pulse rounded-pill bg-surface-container" />
        {[0, 1, 2].map((indice) => (
          <span key={indice} className="flex gap-4">
            <span className="h-14 w-14 shrink-0 animate-pulse rounded-control bg-surface-container-low" />
            <span className="flex-1 space-y-2 pt-1">
              <span className="block h-3.5 w-1/2 animate-pulse rounded-pill bg-surface-container" />
              <span className="block h-3 w-1/3 animate-pulse rounded-pill bg-surface-container-low" />
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Icone({ children, className = "size-5" }: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

function IconeTarefas() {
  return (
    <Icone>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </Icone>
  );
}

function IconePrioridade() {
  return (
    <Icone>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17h.01" />
    </Icone>
  );
}

function IconeCalendario() {
  return (
    <Icone>
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M4 10h16M8.5 3v4M15.5 3v4" />
    </Icone>
  );
}

function IconeRelogio() {
  return (
    <Icone className="size-3.5">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icone>
  );
}

function IconeAlerta() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="mt-0.5 size-4 shrink-0">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7.5v5.5M12 16.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

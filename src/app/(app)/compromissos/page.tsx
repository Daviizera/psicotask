"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { CompromissoFormDialog } from "@/components/compromissos/compromisso-form-dialog";
import {
  ROTULOS_STATUS,
  MENSAGENS,
  agoraNaRotina,
  ehCompromisso,
  estaEmAtraso,
  montarAgenda,
  partesDaData,
  type AgoraNaRotina,
  type DiaDaAgenda,
} from "@/components/compromissos/compromissos";
import { ExcluirCompromissoDialog } from "@/components/compromissos/excluir-compromisso-dialog";
import { IconeCalendario, IconeRelogio } from "@/components/compromissos/icones";
import {
  IconeAlerta,
  IconeEditar,
  IconeExcluir,
  IconeMais,
} from "@/components/contextos/icones";
import type {
  Appointment,
  AppointmentStatus,
} from "@/modules/compromissos/types/appointment.types";

type EstadoDaAgenda =
  | { tipo: "carregando" }
  | { tipo: "sucesso"; compromissos: Appointment[] }
  | { tipo: "erro"; mensagem: string };

type Dialogo =
  | { tipo: "criar" }
  | { tipo: "editar"; compromisso: Appointment }
  | { tipo: "excluir"; compromisso: Appointment };

const MENSAGENS_DA_AGENDA = {
  servidor: "Não foi possível carregar os compromissos. Tente novamente em instantes.",
  rede: "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
} as const;

const ESTILO_DO_STATUS: Record<AppointmentStatus, string> = {
  AGENDADO: "bg-primary-fixed/70 text-primary",
  CONCLUIDO: "bg-tertiary-fixed/50 text-tertiary",
  CANCELADO: "bg-surface-container text-on-surface-variant",
};

export default function CompromissosPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoDaAgenda>({ tipo: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);

  const tituloRef = useRef<HTMLHeadingElement>(null);
  // Item que deve receber o foco depois de salvo (pode ter mudado de dia).
  const focoPendenteRef = useRef<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/compromissos", { credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) {
          setEstado({ tipo: "erro", mensagem: MENSAGENS_DA_AGENDA.servidor });
          return;
        }
        const corpo: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        setEstado(
          Array.isArray(corpo) && corpo.every(ehCompromisso)
            ? { tipo: "sucesso", compromissos: corpo }
            : { tipo: "erro", mensagem: MENSAGENS_DA_AGENDA.servidor },
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setEstado({ tipo: "erro", mensagem: MENSAGENS_DA_AGENDA.rede });
        }
      });
    return () => controller.abort();
  }, [router, tentativa]);

  useEffect(() => {
    const id = focoPendenteRef.current;
    if (id === null) return;
    const item = document.getElementById(`compromisso-${id}`);
    if (item) {
      focoPendenteRef.current = null;
      item.focus();
    }
  }, [estado]);

  function tentarNovamente() {
    setEstado({ tipo: "carregando" });
    setTentativa((valor) => valor + 1);
  }

  // Após uma mutação, a agenda é consultada novamente sem esconder os itens atuais.
  function recarregar() {
    setTentativa((valor) => valor + 1);
  }

  // Aplica o compromisso devolvido pela API até a nova consulta terminar.
  function aplicarCompromisso(compromisso: Appointment) {
    focoPendenteRef.current = compromisso.id;
    setEstado((atual) => {
      if (atual.tipo !== "sucesso") return atual;
      const existe = atual.compromissos.some((item) => item.id === compromisso.id);
      return {
        ...atual,
        compromissos: existe
          ? atual.compromissos.map((item) => (item.id === compromisso.id ? compromisso : item))
          : [...atual.compromissos, compromisso],
      };
    });
  }

  function abrir(novo: Dialogo) {
    setAviso(null);
    setDialogo(novo);
  }

  function concluir(texto: string, erro = false) {
    setDialogo(null);
    setAviso({ texto, erro });
    recarregar();
  }

  function handleSalvo(compromisso: Appointment) {
    const anterior = dialogo?.tipo === "editar" ? dialogo.compromisso : null;
    aplicarCompromisso(compromisso);
    if (!anterior) {
      concluir(`Compromisso “${compromisso.titulo}” criado.`);
    } else if (anterior.status !== compromisso.status) {
      concluir(
        `Compromisso “${compromisso.titulo}” atualizado. Status: ${ROTULOS_STATUS[compromisso.status]}.`,
      );
    } else {
      concluir(`Compromisso “${compromisso.titulo}” atualizado.`);
    }
  }

  function handleExcluido() {
    const titulo = dialogo?.tipo === "excluir" ? dialogo.compromisso.titulo : "";
    concluir(`Compromisso “${titulo}” excluído.`);
    // O item que abriu a confirmação deixa de existir; o foco volta ao título.
    requestAnimationFrame(() => tituloRef.current?.focus());
  }

  function handleNaoEncontrado() {
    concluir(MENSAGENS.naoEncontrado, true);
    requestAnimationFrame(() => tituloRef.current?.focus());
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1
            ref={tituloRef}
            tabIndex={-1}
            className="text-headline-lg-mobile text-on-surface focus:outline-none sm:text-headline-lg"
          >
            Compromissos
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Sua agenda em ordem cronológica, com os próximos compromissos em destaque.
          </p>
        </div>
        <button
          type="button"
          onClick={() => abrir({ tipo: "criar" })}
          className="flex shrink-0 items-center justify-center gap-2 rounded-control bg-primary-container px-4 py-2.5 text-label-lg text-on-primary shadow-sm shadow-primary/20 transition-colors duration-150 hover:bg-primary active:scale-[0.99]"
        >
          <IconeMais />
          Novo compromisso
        </button>
      </header>

      <div aria-live="polite" className="empty:hidden">
        {aviso && (
          <p
            className={`rounded-control border px-3.5 py-3 text-body-md ${
              aviso.erro
                ? "border-error/30 bg-error-container text-error"
                : "border-tertiary/20 bg-tertiary-fixed/40 text-tertiary"
            }`}
          >
            {aviso.texto}
          </p>
        )}
      </div>

      {estado.tipo === "carregando" && <AgendaCarregando />}

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

      {estado.tipo === "sucesso" && estado.compromissos.length === 0 && (
        <section className="flex flex-col items-center gap-3 rounded-card border border-outline-variant/40 bg-surface-container-lowest px-5 py-14 text-center shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]">
          <span className="flex size-12 items-center justify-center rounded-pill bg-surface-container-low text-outline">
            <IconeCalendario />
          </span>
          <h2 className="text-label-lg text-on-surface">Nenhum compromisso cadastrado</h2>
          <p className="max-w-sm text-body-md text-on-surface-variant">
            Você ainda não tem compromissos. Cadastre o primeiro para organizar sua agenda por
            data e horário.
          </p>
          <button
            type="button"
            onClick={() => abrir({ tipo: "criar" })}
            className="mt-2 flex items-center justify-center gap-2 rounded-control bg-primary-container px-4 py-2.5 text-label-lg text-on-primary shadow-sm shadow-primary/20 transition-colors duration-150 hover:bg-primary"
          >
            <IconeMais />
            Criar primeiro compromisso
          </button>
        </section>
      )}

      {estado.tipo === "sucesso" && estado.compromissos.length > 0 && (
        <Agenda
          compromissos={estado.compromissos}
          onEditar={(compromisso) => abrir({ tipo: "editar", compromisso })}
          onExcluir={(compromisso) => abrir({ tipo: "excluir", compromisso })}
        />
      )}

      {(dialogo?.tipo === "criar" || dialogo?.tipo === "editar") && (
        <CompromissoFormDialog
          key={dialogo.tipo === "editar" ? dialogo.compromisso.id : "novo"}
          compromisso={dialogo.tipo === "editar" ? dialogo.compromisso : undefined}
          onFechar={() => setDialogo(null)}
          onSalvo={handleSalvo}
          onNaoEncontrado={handleNaoEncontrado}
        />
      )}

      {dialogo?.tipo === "excluir" && (
        <ExcluirCompromissoDialog
          key={dialogo.compromisso.id}
          compromisso={dialogo.compromisso}
          onFechar={() => setDialogo(null)}
          onExcluido={handleExcluido}
          onNaoEncontrado={handleNaoEncontrado}
        />
      )}
    </div>
  );
}

function Agenda({
  compromissos,
  onEditar,
  onExcluir,
}: Readonly<{
  compromissos: Appointment[];
  onEditar: (compromisso: Appointment) => void;
  onExcluir: (compromisso: Appointment) => void;
}>) {
  const agora = agoraNaRotina();
  const { proximos, anteriores } = montarAgenda(compromissos, agora.data);
  const total = (dias: DiaDaAgenda[]) =>
    dias.reduce((soma, dia) => soma + dia.compromissos.length, 0);

  return (
    <div className="space-y-10">
      <SecaoDaAgenda
        id="agenda-proximos"
        titulo="Hoje e próximos"
        quantidade={total(proximos)}
        vazio="Nenhum compromisso a partir de hoje."
        dias={proximos}
        agora={agora}
        passado={false}
        onEditar={onEditar}
        onExcluir={onExcluir}
      />
      {anteriores.length > 0 && (
        <SecaoDaAgenda
          id="agenda-anteriores"
          titulo="Anteriores"
          descricao="Do mais recente para o mais antigo."
          quantidade={total(anteriores)}
          dias={anteriores}
          agora={agora}
          passado
          onEditar={onEditar}
          onExcluir={onExcluir}
        />
      )}
    </div>
  );
}

function SecaoDaAgenda({
  id,
  titulo,
  descricao,
  quantidade,
  vazio,
  dias,
  agora,
  passado,
  onEditar,
  onExcluir,
}: Readonly<{
  id: string;
  titulo: string;
  descricao?: string;
  quantidade: number;
  vazio?: string;
  dias: DiaDaAgenda[];
  agora: AgoraNaRotina;
  passado: boolean;
  onEditar: (compromisso: Appointment) => void;
  onExcluir: (compromisso: Appointment) => void;
}>) {
  return (
    <section aria-labelledby={`${id}-titulo`} className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={`${id}-titulo`} className="text-headline-sm text-on-surface">
          {titulo}
        </h2>
        <span className="rounded-pill bg-surface-container px-2.5 py-0.5 text-label-md text-on-surface-variant">
          {quantidade}
          <span className="sr-only">{quantidade === 1 ? " compromisso" : " compromissos"}</span>
        </span>
        {descricao && <p className="text-body-sm text-on-surface-variant">{descricao}</p>}
      </div>

      {dias.length === 0 ? (
        <p className="rounded-card border-2 border-dashed border-outline-variant/40 bg-surface-container-lowest/40 px-5 py-8 text-center text-body-md text-outline">
          {vazio}
        </p>
      ) : (
        <ol className="space-y-4">
          {dias.map((dia) => (
            <DiaDaAgendaCartao
              key={dia.data}
              dia={dia}
              ehHoje={dia.data === agora.data}
              agora={agora}
              passado={passado}
              onEditar={onEditar}
              onExcluir={onExcluir}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function DiaDaAgendaCartao({
  dia,
  ehHoje,
  agora,
  passado,
  onEditar,
  onExcluir,
}: Readonly<{
  dia: DiaDaAgenda;
  ehHoje: boolean;
  agora: AgoraNaRotina;
  passado: boolean;
  onEditar: (compromisso: Appointment) => void;
  onExcluir: (compromisso: Appointment) => void;
}>) {
  const partes = partesDaData(dia.data);
  const tituloId = `dia-${dia.data}-titulo`;

  return (
    <li
      aria-labelledby={tituloId}
      className={`overflow-hidden rounded-card border bg-surface-container-lowest shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] ${
        ehHoje ? "border-primary-container/40" : "border-outline-variant/40"
      }`}
    >
      <div
        className={`flex items-center gap-4 border-b border-outline-variant/30 px-5 py-3.5 ${
          ehHoje ? "bg-primary-fixed/25" : passado ? "bg-surface-container-low/40" : ""
        }`}
      >
        <div
          aria-hidden="true"
          className={`flex w-12 shrink-0 flex-col items-center justify-center rounded-control py-1.5 ${
            ehHoje
              ? "bg-primary-container text-on-primary"
              : passado
                ? "bg-surface-container text-on-surface-variant"
                : "bg-surface-container-low text-primary"
          }`}
        >
          <span className="text-headline-sm leading-none">{partes.dia}</span>
          <span className="mt-1 text-label-sm uppercase">{partes.mes}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <h3 id={tituloId} className="text-label-lg text-on-surface first-letter:uppercase">
            <time dateTime={dia.data}>{partes.extenso}</time>
          </h3>
          {ehHoje && (
            <span className="rounded-pill bg-tertiary-fixed px-2 py-0.5 text-label-sm text-tertiary">
              Hoje
            </span>
          )}
        </div>
        <span className="shrink-0 text-body-sm text-on-surface-variant">
          {dia.compromissos.length}{" "}
          {dia.compromissos.length === 1 ? "compromisso" : "compromissos"}
        </span>
      </div>

      <ul className="divide-y divide-outline-variant/30">
        {dia.compromissos.map((compromisso) => (
          <ItemCompromisso
            key={compromisso.id}
            compromisso={compromisso}
            emAtraso={estaEmAtraso(compromisso, agora)}
            passado={passado}
            onEditar={() => onEditar(compromisso)}
            onExcluir={() => onExcluir(compromisso)}
          />
        ))}
      </ul>
    </li>
  );
}

function ItemCompromisso({
  compromisso,
  emAtraso,
  passado,
  onEditar,
  onExcluir,
}: Readonly<{
  compromisso: Appointment;
  emAtraso: boolean;
  passado: boolean;
  onEditar: () => void;
  onExcluir: () => void;
}>) {
  const cancelado = compromisso.status === "CANCELADO";
  const tituloId = `compromisso-${compromisso.id}-titulo`;

  return (
    <li
      id={`compromisso-${compromisso.id}`}
      tabIndex={-1}
      aria-labelledby={tituloId}
      className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-surface-container-low/40 sm:flex-row sm:items-start sm:gap-5"
    >
      <p
        className={`flex shrink-0 items-center gap-1.5 text-label-lg tabular-nums sm:w-32 sm:pt-0.5 ${
          passado || cancelado ? "text-on-surface-variant" : "text-primary"
        }`}
      >
        <IconeRelogio />
        <span>
          <span className="sr-only">Das </span>
          <time dateTime={compromisso.horaInicio}>{compromisso.horaInicio}</time>
          <span aria-hidden="true">–</span>
          <span className="sr-only"> às </span>
          <time dateTime={compromisso.horaFim}>{compromisso.horaFim}</time>
        </span>
      </p>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4
            id={tituloId}
            className={`min-w-0 break-words text-label-lg ${
              cancelado
                ? "text-on-surface-variant line-through decoration-outline/60"
                : "text-on-surface"
            }`}
          >
            {compromisso.titulo}
          </h4>
          <span
            className={`rounded-pill px-2 py-0.5 text-label-sm ${ESTILO_DO_STATUS[compromisso.status]}`}
          >
            <span className="sr-only">Status: </span>
            {ROTULOS_STATUS[compromisso.status]}
          </span>
          {emAtraso && (
            <span className="rounded-pill bg-error-container/70 px-2 py-0.5 text-label-sm text-error">
              Em atraso
            </span>
          )}
        </div>
        {compromisso.descricao && (
          <p className="line-clamp-2 whitespace-pre-line break-words text-body-sm text-on-surface-variant">
            {compromisso.descricao}
          </p>
        )}
      </div>

      <div className="flex shrink-0 gap-0.5 self-end sm:self-start">
        <button
          type="button"
          onClick={onEditar}
          aria-label={`Editar compromisso ${compromisso.titulo}`}
          title="Editar"
          className="rounded-control p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
        >
          <IconeEditar />
        </button>
        <button
          type="button"
          onClick={onExcluir}
          aria-label={`Excluir compromisso ${compromisso.titulo}`}
          title="Excluir"
          className="rounded-control p-1.5 text-on-surface-variant transition-colors hover:bg-error-container/40 hover:text-error"
        >
          <IconeExcluir />
        </button>
      </div>
    </li>
  );
}

function AgendaCarregando() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Carregando compromissos…
      </p>
      <div aria-hidden="true" className="space-y-4">
        <span className="block h-5 w-40 animate-pulse rounded-pill bg-surface-container" />
        {[0, 1].map((dia) => (
          <div
            key={dia}
            className="overflow-hidden rounded-card border border-outline-variant/40 bg-surface-container-lowest"
          >
            <span className="flex items-center gap-4 border-b border-outline-variant/30 px-5 py-3.5">
              <span className="h-12 w-12 shrink-0 animate-pulse rounded-control bg-surface-container-low" />
              <span className="h-3.5 w-56 animate-pulse rounded-pill bg-surface-container" />
            </span>
            {[0, 1].map((item) => (
              <span key={item} className="flex gap-5 px-5 py-4">
                <span className="h-4 w-28 shrink-0 animate-pulse rounded-pill bg-surface-container-low" />
                <span className="flex-1 space-y-2">
                  <span className="block h-3.5 w-1/2 animate-pulse rounded-pill bg-surface-container" />
                  <span className="block h-3 w-1/3 animate-pulse rounded-pill bg-surface-container-low" />
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

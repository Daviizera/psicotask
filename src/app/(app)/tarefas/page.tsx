"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  IconeAlerta,
  IconeCarregando,
  IconeContexto,
  IconeEditar,
  IconeExcluir,
  IconeMais,
} from "@/components/contextos/icones";
import { ehContexto, lerCorpoDeErro, ordenarContextos } from "@/components/contextos/respostas";
import { ExcluirTarefaDialog } from "@/components/tarefas/excluir-tarefa-dialog";
import {
  IconeAvancar,
  IconeCalendario,
  IconeConcluir,
  IconeTarefas,
  IconeVoltar,
} from "@/components/tarefas/icones";
import { TarefaFormDialog } from "@/components/tarefas/tarefa-form-dialog";
import {
  MENSAGENS,
  ROTULOS_PRIORIDADE,
  ROTULOS_STATUS,
  STATUS,
  TRANSICOES,
  agruparPorStatus,
  ehTarefa,
  formatarDataCurta,
  formatarDataLonga,
  hojeNaRotina,
} from "@/components/tarefas/tarefas";
import type { Context } from "@/modules/contextos/types/context.types";
import type {
  Task,
  TaskPriority,
  TaskStatus,
  UpdateTaskInput,
} from "@/modules/tarefas/types/task.types";

type EstadoDoQuadro =
  | { tipo: "carregando" }
  | { tipo: "sucesso"; tarefas: Task[]; contextos: Context[] }
  | { tipo: "erro"; mensagem: string };

type Dialogo =
  | { tipo: "criar"; status: TaskStatus }
  | { tipo: "editar"; tarefa: Task }
  | { tipo: "excluir"; tarefa: Task };

const MENSAGENS_DO_QUADRO = {
  servidor: "Não foi possível carregar as tarefas. Tente novamente em instantes.",
  rede: "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
} as const;

const ESTILO_DA_COLUNA: Record<TaskStatus, { ponto: string; contador: string; vazio: string }> = {
  PENDENTE: {
    ponto: "bg-secondary ring-secondary/15",
    contador: "bg-secondary-container/50 text-secondary",
    vazio: "Nenhuma tarefa pendente.",
  },
  EM_ANDAMENTO: {
    ponto: "bg-primary-container ring-primary-container/15",
    contador: "bg-primary-fixed/70 text-primary",
    vazio: "Nenhuma tarefa em andamento.",
  },
  CONCLUIDA: {
    ponto: "bg-tertiary ring-tertiary/15",
    contador: "bg-tertiary-fixed/50 text-tertiary",
    vazio: "Nenhuma tarefa concluída.",
  },
};

const ESTILO_DA_PRIORIDADE: Record<TaskPriority, { badge: string; ponto: string }> = {
  ALTA: { badge: "bg-error-container text-error", ponto: "bg-error" },
  MEDIA: { badge: "bg-secondary-container/45 text-secondary", ponto: "bg-secondary" },
  BAIXA: { badge: "bg-surface-container text-on-surface-variant", ponto: "bg-outline" },
};

export default function TarefasPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoDoQuadro>({ tipo: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);
  // Tarefas com mudança de status em andamento, com o status de destino.
  const [emMovimento, setEmMovimento] = useState<ReadonlyMap<number, TaskStatus>>(new Map());

  const tituloRef = useRef<HTMLHeadingElement>(null);
  const emMovimentoRef = useRef(new Set<number>());
  // Card que deve receber o foco depois de mudar de coluna.
  const focoPendenteRef = useRef<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const opcoes = { credentials: "same-origin", signal: controller.signal } as const;

    // Tarefas retornam apenas `contextoId`; os nomes vêm de GET /api/contextos.
    Promise.all([fetch("/api/tarefas", opcoes), fetch("/api/contextos", opcoes)])
      .then(async ([respostaTarefas, respostaContextos]) => {
        if (respostaTarefas.status === 401 || respostaContextos.status === 401) {
          router.replace("/login");
          return;
        }
        if (!respostaTarefas.ok || !respostaContextos.ok) {
          setEstado({ tipo: "erro", mensagem: MENSAGENS_DO_QUADRO.servidor });
          return;
        }
        const [tarefas, contextos]: unknown[] = await Promise.all([
          respostaTarefas.json().catch(() => null),
          respostaContextos.json().catch(() => null),
        ]);
        if (controller.signal.aborted) return;
        setEstado(
          Array.isArray(tarefas) &&
            tarefas.every(ehTarefa) &&
            Array.isArray(contextos) &&
            contextos.every(ehContexto)
            ? { tipo: "sucesso", tarefas, contextos: ordenarContextos(contextos) }
            : { tipo: "erro", mensagem: MENSAGENS_DO_QUADRO.servidor },
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setEstado({ tipo: "erro", mensagem: MENSAGENS_DO_QUADRO.rede });
        }
      });
    return () => controller.abort();
  }, [router, tentativa]);

  // O card movido é recriado na nova coluna; o foco o acompanha.
  useEffect(() => {
    const id = focoPendenteRef.current;
    if (id === null) return;
    const card = document.getElementById(`tarefa-${id}`);
    if (card) {
      focoPendenteRef.current = null;
      card.focus();
    }
  }, [estado]);

  function tentarNovamente() {
    setEstado({ tipo: "carregando" });
    setTentativa((valor) => valor + 1);
  }

  // Após uma mutação, o quadro é consultado novamente sem esconder os cards atuais.
  function recarregar() {
    setTentativa((valor) => valor + 1);
  }

  // Aplica a tarefa devolvida pela API até a nova consulta terminar.
  function aplicarTarefa(tarefa: Task) {
    focoPendenteRef.current = tarefa.id;
    setEstado((atual) => {
      if (atual.tipo !== "sucesso") return atual;
      const existe = atual.tarefas.some((item) => item.id === tarefa.id);
      return {
        ...atual,
        tarefas: existe
          ? atual.tarefas.map((item) => (item.id === tarefa.id ? tarefa : item))
          : [...atual.tarefas, tarefa],
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

  function handleSalva(tarefa: Task) {
    const editando = dialogo?.tipo === "editar";
    aplicarTarefa(tarefa);
    concluir(editando ? `Tarefa “${tarefa.titulo}” atualizada.` : `Tarefa “${tarefa.titulo}” criada.`);
  }

  function handleExcluida() {
    const titulo = dialogo?.tipo === "excluir" ? dialogo.tarefa.titulo : "";
    concluir(`Tarefa “${titulo}” excluída.`);
    // O card que abriu a confirmação deixa de existir; o foco volta ao título.
    requestAnimationFrame(() => tituloRef.current?.focus());
  }

  function handleNaoEncontrada() {
    concluir(MENSAGENS.naoEncontrada, true);
    requestAnimationFrame(() => tituloRef.current?.focus());
  }

  function encerrarMovimento(id: number) {
    emMovimentoRef.current.delete(id);
    setEmMovimento((atual) => {
      const proximo = new Map(atual);
      proximo.delete(id);
      return proximo;
    });
  }

  // Mudança de status: PUT /api/tarefas/:id somente com { status }.
  async function alterarStatus(tarefa: Task, destino: TaskStatus) {
    if (emMovimentoRef.current.has(tarefa.id)) return;
    emMovimentoRef.current.add(tarefa.id);
    setEmMovimento((atual) => new Map(atual).set(tarefa.id, destino));
    setAviso(null);

    const payload: UpdateTaskInput = { status: destino };
    let response: Response;
    try {
      response = await fetch(`/api/tarefas/${tarefa.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
    } catch {
      encerrarMovimento(tarefa.id);
      setAviso({ texto: MENSAGENS.rede, erro: true });
      return;
    }

    if (response.status === 401) {
      router.replace("/login");
      return;
    }

    if (response.ok) {
      const corpo: unknown = await response.json().catch(() => null);
      encerrarMovimento(tarefa.id);
      if (ehTarefa(corpo)) {
        aplicarTarefa(corpo);
        setAviso({
          texto: `Tarefa “${corpo.titulo}” movida para ${ROTULOS_STATUS[corpo.status]}.`,
          erro: false,
        });
      } else {
        setAviso({ texto: MENSAGENS.servidor, erro: true });
      }
      recarregar();
      return;
    }

    const corpo = await lerCorpoDeErro(response);
    encerrarMovimento(tarefa.id);

    if (response.status === 404) {
      setAviso({ texto: MENSAGENS.naoEncontrada, erro: true });
      recarregar();
    } else if (response.status === 403) {
      setAviso({ texto: MENSAGENS.origem, erro: true });
    } else if (response.status === 400) {
      setAviso({
        texto: typeof corpo.error === "string" ? corpo.error : MENSAGENS.validacao,
        erro: true,
      });
    } else {
      setAviso({ texto: MENSAGENS.servidor, erro: true });
    }
  }

  const carregado = estado.tipo === "sucesso" ? estado : null;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1
            ref={tituloRef}
            tabIndex={-1}
            className="text-headline-lg-mobile text-on-surface focus:outline-none sm:text-headline-lg"
          >
            Tarefas
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Acompanhe suas tarefas por status e mova cada uma conforme avança.
          </p>
        </div>
        <button
          type="button"
          onClick={() => abrir({ tipo: "criar", status: "PENDENTE" })}
          disabled={!carregado}
          className="flex shrink-0 items-center justify-center gap-2 rounded-control bg-primary-container px-4 py-2.5 text-label-lg text-on-primary shadow-sm shadow-primary/20 transition-colors duration-150 hover:bg-primary active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-primary-container"
        >
          <IconeMais />
          Nova tarefa
        </button>
      </header>

      {/* Regiões sempre montadas: vazias, saem do fluxo visual (sr-only) mas
          permanecem na árvore de acessibilidade para que a mensagem inserida
          seja anunciada. Sucesso é educado; erro usa role="alert". */}
      <div aria-live="polite" className="empty:sr-only">
        {aviso && !aviso.erro && (
          <p className="rounded-control border border-tertiary/20 bg-tertiary-fixed/40 px-3.5 py-3 text-body-md text-tertiary">
            {aviso.texto}
          </p>
        )}
      </div>
      <div role="alert" className="empty:sr-only">
        {aviso?.erro && (
          <p className="rounded-control border border-error/30 bg-error-container px-3.5 py-3 text-body-md text-error">
            {aviso.texto}
          </p>
        )}
      </div>

      {estado.tipo === "carregando" && <QuadroCarregando />}

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

      {carregado && (
        <>
          {carregado.tarefas.length === 0 && (
            <QuadroVazio
              semContextos={carregado.contextos.length === 0}
              onCriar={() => abrir({ tipo: "criar", status: "PENDENTE" })}
            />
          )}
          <Quadro
            tarefas={carregado.tarefas}
            contextos={carregado.contextos}
            emMovimento={emMovimento}
            onCriar={(status) => abrir({ tipo: "criar", status })}
            onEditar={(tarefa) => abrir({ tipo: "editar", tarefa })}
            onExcluir={(tarefa) => abrir({ tipo: "excluir", tarefa })}
            onAlterarStatus={alterarStatus}
          />
        </>
      )}

      {carregado && (dialogo?.tipo === "criar" || dialogo?.tipo === "editar") && (
        <TarefaFormDialog
          key={dialogo.tipo === "editar" ? dialogo.tarefa.id : `nova-${dialogo.status}`}
          tarefa={dialogo.tipo === "editar" ? dialogo.tarefa : undefined}
          statusInicial={dialogo.tipo === "criar" ? dialogo.status : undefined}
          contextos={carregado.contextos}
          onFechar={() => setDialogo(null)}
          onSalvo={handleSalva}
          onNaoEncontrada={handleNaoEncontrada}
        />
      )}

      {dialogo?.tipo === "excluir" && (
        <ExcluirTarefaDialog
          key={dialogo.tarefa.id}
          tarefa={dialogo.tarefa}
          onFechar={() => setDialogo(null)}
          onExcluida={handleExcluida}
          onNaoEncontrada={handleNaoEncontrada}
        />
      )}
    </div>
  );
}

function QuadroVazio({
  semContextos,
  onCriar,
}: Readonly<{ semContextos: boolean; onCriar: () => void }>) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-card border border-outline-variant/40 bg-surface-container-lowest px-5 py-10 text-center shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]">
      <span className="flex size-12 items-center justify-center rounded-pill bg-surface-container-low text-outline">
        {semContextos ? <IconeContexto /> : <IconeTarefas />}
      </span>
      <h2 className="text-label-lg text-on-surface">Nenhuma tarefa criada</h2>
      {semContextos ? (
        <>
          <p className="max-w-md text-body-md text-on-surface-variant">
            Toda tarefa pertence a um contexto. Cadastre seu primeiro contexto para começar a
            criar tarefas.
          </p>
          <Link
            href="/contextos"
            className="mt-2 flex items-center justify-center gap-2 rounded-control bg-primary-container px-4 py-2.5 text-label-lg text-on-primary shadow-sm shadow-primary/20 transition-colors duration-150 hover:bg-primary"
          >
            Ir para Contextos
          </Link>
        </>
      ) : (
        <>
          <p className="max-w-md text-body-md text-on-surface-variant">
            Crie a primeira tarefa e acompanhe seu andamento pelas colunas abaixo.
          </p>
          <button
            type="button"
            onClick={onCriar}
            className="mt-2 flex items-center justify-center gap-2 rounded-control bg-primary-container px-4 py-2.5 text-label-lg text-on-primary shadow-sm shadow-primary/20 transition-colors duration-150 hover:bg-primary"
          >
            <IconeMais />
            Criar primeira tarefa
          </button>
        </>
      )}
    </section>
  );
}

function Quadro({
  tarefas,
  contextos,
  emMovimento,
  onCriar,
  onEditar,
  onExcluir,
  onAlterarStatus,
}: Readonly<{
  tarefas: Task[];
  contextos: Context[];
  emMovimento: ReadonlyMap<number, TaskStatus>;
  onCriar: (status: TaskStatus) => void;
  onEditar: (tarefa: Task) => void;
  onExcluir: (tarefa: Task) => void;
  onAlterarStatus: (tarefa: Task, destino: TaskStatus) => void;
}>) {
  const colunas = agruparPorStatus(tarefas);
  const nomesDosContextos = new Map(contextos.map((contexto) => [contexto.id, contexto.nome]));
  const hoje = hojeNaRotina();

  return (
    <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
      {STATUS.map((status) => {
        const estilo = ESTILO_DA_COLUNA[status];
        const itens = colunas[status];
        const tituloId = `coluna-${status}-titulo`;
        return (
          <section
            key={status}
            aria-labelledby={tituloId}
            className="flex min-w-0 flex-col rounded-card border border-outline-variant/30 bg-surface-container-low/60 p-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.02)]"
          >
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-outline-variant/30 pb-3">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`size-2.5 shrink-0 rounded-pill ring-4 ${estilo.ponto}`}
                />
                <h2 id={tituloId} className="text-label-lg text-on-surface">
                  {ROTULOS_STATUS[status]}
                </h2>
                <span className={`rounded-pill px-2 py-0.5 text-label-md ${estilo.contador}`}>
                  {itens.length}
                  <span className="sr-only">{itens.length === 1 ? " tarefa" : " tarefas"}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => onCriar(status)}
                aria-label={`Nova tarefa em ${ROTULOS_STATUS[status]}`}
                title={`Nova tarefa em ${ROTULOS_STATUS[status]}`}
                className="shrink-0 rounded-control p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-lowest hover:text-primary"
              >
                <IconeMais />
              </button>
            </div>

            {itens.length === 0 ? (
              <p className="rounded-control border-2 border-dashed border-outline-variant/40 bg-surface-container-lowest/40 px-3 py-6 text-center text-body-sm text-outline">
                {estilo.vazio}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {itens.map((tarefa) => (
                  <CartaoTarefa
                    key={tarefa.id}
                    tarefa={tarefa}
                    nomeDoContexto={nomesDosContextos.get(tarefa.contextoId)}
                    hoje={hoje}
                    destinoEmMovimento={emMovimento.get(tarefa.id)}
                    onEditar={() => onEditar(tarefa)}
                    onExcluir={() => onExcluir(tarefa)}
                    onAlterarStatus={(destino) => onAlterarStatus(tarefa, destino)}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function CartaoTarefa({
  tarefa,
  nomeDoContexto,
  hoje,
  destinoEmMovimento,
  onEditar,
  onExcluir,
  onAlterarStatus,
}: Readonly<{
  tarefa: Task;
  nomeDoContexto: string | undefined;
  hoje: string;
  destinoEmMovimento: TaskStatus | undefined;
  onEditar: () => void;
  onExcluir: () => void;
  onAlterarStatus: (destino: TaskStatus) => void;
}>) {
  const concluida = tarefa.status === "CONCLUIDA";
  const movendo = destinoEmMovimento !== undefined;
  const prioridade = ESTILO_DA_PRIORIDADE[tarefa.prioridade];
  const tituloId = `tarefa-${tarefa.id}-titulo`;
  // Indicação apenas visual, calculada com o mesmo "hoje" usado pelo backend.
  const atrasada = !concluida && tarefa.prazo !== undefined && tarefa.prazo < hoje;
  const venceHoje = !concluida && tarefa.prazo === hoje;

  return (
    <li>
      <article
        id={`tarefa-${tarefa.id}`}
        tabIndex={-1}
        aria-labelledby={tituloId}
        aria-busy={movendo || undefined}
        className={`flex min-w-0 flex-col gap-2.5 rounded-control border bg-surface-container-lowest p-3.5 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,opacity] duration-150 hover:border-primary-container/40 hover:shadow-[0_10px_15px_-3px_rgba(15,23,42,0.07),0_4px_6px_-4px_rgba(15,23,42,0.05)] ${
          concluida ? "border-outline-variant/30" : "border-outline-variant/40"
        } ${movendo ? "opacity-70" : ""}`}
      >
        <div className="flex items-start justify-between gap-2">
          <span
            className="inline-flex min-w-0 items-center gap-1.5 rounded-pill bg-surface-container-low px-2 py-0.5 text-label-md text-on-surface-variant"
            title={nomeDoContexto}
          >
            <IconeContexto className="size-3.5 shrink-0 text-outline" />
            <span className="sr-only">Contexto: </span>
            <span className="truncate">{nomeDoContexto ?? "Contexto indisponível"}</span>
          </span>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-pill px-2 py-0.5 text-label-sm ${prioridade.badge}`}
          >
            <span aria-hidden="true" className={`size-1.5 rounded-pill ${prioridade.ponto}`} />
            <span className="sr-only">Prioridade </span>
            {ROTULOS_PRIORIDADE[tarefa.prioridade]}
          </span>
        </div>

        <div className="space-y-1">
          <h3
            id={tituloId}
            className={`break-words text-label-lg ${
              concluida
                ? "text-on-surface-variant line-through decoration-outline/60"
                : "text-on-surface"
            }`}
          >
            {tarefa.titulo}
          </h3>
          {tarefa.descricao && (
            <p className="line-clamp-2 whitespace-pre-line break-words text-body-sm text-on-surface-variant">
              {tarefa.descricao}
            </p>
          )}
        </div>

        {tarefa.prazo && (
          <p
            className={`flex items-center gap-1.5 text-body-sm ${
              atrasada ? "font-semibold text-error" : "text-on-surface-variant"
            }`}
          >
            <IconeCalendario />
            <span>
              <span className="sr-only">Prazo: </span>
              <time dateTime={tarefa.prazo} title={formatarDataLonga(tarefa.prazo)}>
                {formatarDataCurta(tarefa.prazo)}
              </time>
            </span>
            {atrasada && (
              <span className="rounded-pill bg-error-container/70 px-1.5 text-label-sm">
                Em atraso
              </span>
            )}
            {venceHoje && (
              <span className="rounded-pill bg-secondary-container/45 px-1.5 text-label-sm text-secondary">
                Hoje
              </span>
            )}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-outline-variant/30 pt-2.5">
          <div className="flex flex-wrap gap-1.5">
            {TRANSICOES[tarefa.status].map((transicao) => {
              const esteMovimento = destinoEmMovimento === transicao.destino;
              return (
                <button
                  key={transicao.destino}
                  type="button"
                  onClick={() => onAlterarStatus(transicao.destino)}
                  disabled={movendo}
                  aria-busy={esteMovimento || undefined}
                  className={`flex items-center gap-1 rounded-control border px-2.5 py-1.5 text-label-md transition-colors disabled:cursor-wait disabled:opacity-70 ${
                    transicao.destino === "CONCLUIDA"
                      ? "border-tertiary/25 bg-tertiary-fixed/30 text-tertiary hover:bg-tertiary-fixed/60"
                      : "border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
                  }`}
                >
                  {esteMovimento ? (
                    <IconeCarregando />
                  ) : transicao.sentido === "voltar" ? (
                    <IconeVoltar />
                  ) : transicao.destino === "CONCLUIDA" ? (
                    <IconeConcluir />
                  ) : (
                    <IconeAvancar />
                  )}
                  {transicao.rotulo}
                  <span className="sr-only">
                    {" "}
                    tarefa “{tarefa.titulo}”: mover para {ROTULOS_STATUS[transicao.destino]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex shrink-0 gap-0.5">
            <button
              type="button"
              onClick={onEditar}
              disabled={movendo}
              aria-label={`Editar tarefa ${tarefa.titulo}`}
              title="Editar"
              className="rounded-control p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary disabled:cursor-wait disabled:opacity-60"
            >
              <IconeEditar />
            </button>
            <button
              type="button"
              onClick={onExcluir}
              disabled={movendo}
              aria-label={`Excluir tarefa ${tarefa.titulo}`}
              title="Excluir"
              className="rounded-control p-1.5 text-on-surface-variant transition-colors hover:bg-error-container/40 hover:text-error disabled:cursor-wait disabled:opacity-60"
            >
              <IconeExcluir />
            </button>
          </div>
        </div>
      </article>
    </li>
  );
}

function QuadroCarregando() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Carregando tarefas…
      </p>
      <div aria-hidden="true" className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((coluna) => (
          <div
            key={coluna}
            className="space-y-3 rounded-card border border-outline-variant/30 bg-surface-container-low/60 p-3.5"
          >
            <span className="flex items-center gap-2 border-b border-outline-variant/30 pb-3">
              <span className="size-2.5 animate-pulse rounded-pill bg-surface-container-high" />
              <span className="h-3.5 w-24 animate-pulse rounded-pill bg-surface-container" />
            </span>
            {[0, 1].map((cartao) => (
              <span
                key={cartao}
                className="block space-y-2.5 rounded-control border border-outline-variant/40 bg-surface-container-lowest p-3.5"
              >
                <span className="flex justify-between">
                  <span className="h-4 w-20 animate-pulse rounded-pill bg-surface-container-low" />
                  <span className="h-4 w-12 animate-pulse rounded-pill bg-surface-container-low" />
                </span>
                <span className="block h-3.5 w-3/4 animate-pulse rounded-pill bg-surface-container" />
                <span className="block h-3 w-1/2 animate-pulse rounded-pill bg-surface-container-low" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

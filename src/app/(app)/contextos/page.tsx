"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ContextoFormDialog } from "@/components/contextos/contexto-form-dialog";
import { ExcluirContextoDialog } from "@/components/contextos/excluir-contexto-dialog";
import {
  IconeAlerta,
  IconeContexto,
  IconeEditar,
  IconeExcluir,
  IconeMais,
} from "@/components/contextos/icones";
import { ehContexto, ordenarContextos } from "@/components/contextos/respostas";
import type { Context } from "@/modules/contextos/types/context.types";

type EstadoDaLista =
  | { tipo: "carregando" }
  | { tipo: "sucesso"; contextos: Context[] }
  | { tipo: "erro"; mensagem: string };

type Dialogo =
  | { tipo: "criar" }
  | { tipo: "editar"; contexto: Context }
  | { tipo: "excluir"; contexto: Context };

const MENSAGENS_DA_LISTA = {
  servidor: "Não foi possível carregar os contextos. Tente novamente em instantes.",
  rede: "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
} as const;

export default function ContextosPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoDaLista>({ tipo: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);

  const tituloRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/contextos", { credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) {
          setEstado({ tipo: "erro", mensagem: MENSAGENS_DA_LISTA.servidor });
          return;
        }
        const corpo: unknown = await response.json();
        setEstado(
          Array.isArray(corpo) && corpo.every(ehContexto)
            ? { tipo: "sucesso", contextos: ordenarContextos(corpo) }
            : { tipo: "erro", mensagem: MENSAGENS_DA_LISTA.servidor },
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setEstado({ tipo: "erro", mensagem: MENSAGENS_DA_LISTA.rede });
        }
      });
    return () => controller.abort();
  }, [router, tentativa]);

  function tentarNovamente() {
    setEstado({ tipo: "carregando" });
    setTentativa((valor) => valor + 1);
  }

  // Após uma mutação, a lista é consultada novamente sem esconder os itens atuais.
  function recarregar() {
    setTentativa((valor) => valor + 1);
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

  function handleSalvo(contexto: Context) {
    const editando = dialogo?.tipo === "editar";
    concluir(editando ? `Contexto “${contexto.nome}” atualizado.` : `Contexto “${contexto.nome}” criado.`);
  }

  function handleExcluido() {
    const nome = dialogo?.tipo === "excluir" ? dialogo.contexto.nome : "";
    concluir(`Contexto “${nome}” excluído.`);
    // O botão que abriu a confirmação deixa de existir; o foco volta ao título.
    requestAnimationFrame(() => tituloRef.current?.focus());
  }

  function handleNaoEncontrado() {
    concluir("Este contexto não foi encontrado. Ele pode já ter sido removido.", true);
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
            Contextos
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Contextos organizam suas tarefas por área da rotina, como estudos, supervisão ou
            administração.
          </p>
        </div>
        <button
          type="button"
          onClick={() => abrir({ tipo: "criar" })}
          className="flex shrink-0 items-center justify-center gap-2 rounded-control bg-primary-container px-4 py-2.5 text-label-lg text-on-primary shadow-sm shadow-primary/20 transition-colors duration-150 hover:bg-primary active:scale-[0.99]"
        >
          <IconeMais />
          Novo contexto
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

      {estado.tipo === "carregando" && <ListaCarregando />}

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

      {estado.tipo === "sucesso" && estado.contextos.length === 0 && (
        <section className="flex flex-col items-center gap-3 rounded-card border border-outline-variant/40 bg-surface-container-lowest px-5 py-14 text-center shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]">
          <span className="flex size-12 items-center justify-center rounded-pill bg-surface-container-low text-outline">
            <IconeContexto />
          </span>
          <h2 className="text-label-lg text-on-surface">Nenhum contexto criado</h2>
          <p className="max-w-sm text-body-md text-on-surface-variant">
            Você ainda não tem contextos. Crie o primeiro para começar a organizar suas tarefas
            por área da rotina.
          </p>
          <button
            type="button"
            onClick={() => abrir({ tipo: "criar" })}
            className="mt-2 flex items-center justify-center gap-2 rounded-control bg-primary-container px-4 py-2.5 text-label-lg text-on-primary shadow-sm shadow-primary/20 transition-colors duration-150 hover:bg-primary"
          >
            <IconeMais />
            Criar primeiro contexto
          </button>
        </section>
      )}

      {estado.tipo === "sucesso" && estado.contextos.length > 0 && (
        <section aria-labelledby="lista-contextos-titulo" className="space-y-3">
          <h2 id="lista-contextos-titulo" className="sr-only">
            Seus contextos
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {estado.contextos.map((contexto) => (
              <CartaoContexto
                key={contexto.id}
                contexto={contexto}
                onEditar={() => abrir({ tipo: "editar", contexto })}
                onExcluir={() => abrir({ tipo: "excluir", contexto })}
              />
            ))}
          </ul>
        </section>
      )}

      {(dialogo?.tipo === "criar" || dialogo?.tipo === "editar") && (
        <ContextoFormDialog
          key={dialogo.tipo === "editar" ? dialogo.contexto.id : "novo"}
          contexto={dialogo.tipo === "editar" ? dialogo.contexto : undefined}
          onFechar={() => setDialogo(null)}
          onSalvo={handleSalvo}
          onNaoEncontrado={handleNaoEncontrado}
        />
      )}

      {dialogo?.tipo === "excluir" && (
        <ExcluirContextoDialog
          key={dialogo.contexto.id}
          contexto={dialogo.contexto}
          onFechar={() => setDialogo(null)}
          onExcluido={handleExcluido}
          onNaoEncontrado={handleNaoEncontrado}
        />
      )}
    </div>
  );
}

function CartaoContexto({
  contexto,
  onEditar,
  onExcluir,
}: Readonly<{ contexto: Context; onEditar: () => void; onExcluir: () => void }>) {
  return (
    <li
      className="flex min-w-0 flex-col gap-4 rounded-card border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] transition-[border-color,box-shadow] duration-150 hover:border-primary-container/40 hover:shadow-[0_10px_15px_-3px_rgba(15,23,42,0.07),0_4px_6px_-4px_rgba(15,23,42,0.05)]"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-primary-fixed/60 text-primary">
          <IconeContexto />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="break-words text-label-lg text-on-surface">
            {contexto.nome}
          </h3>
          {contexto.descricao ? (
            <p className="line-clamp-3 whitespace-pre-line break-words text-body-sm text-on-surface-variant">
              {contexto.descricao}
            </p>
          ) : (
            <p className="text-body-sm italic text-outline">Sem descrição</p>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-t border-outline-variant/30 pt-3">
        <button
          type="button"
          onClick={onEditar}
          aria-label={`Editar contexto ${contexto.nome}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-control border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary sm:flex-none"
        >
          <IconeEditar />
          Editar
        </button>
        <button
          type="button"
          onClick={onExcluir}
          aria-label={`Excluir contexto ${contexto.nome}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-control border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 text-label-md text-on-surface-variant transition-colors hover:border-error/30 hover:bg-error-container/40 hover:text-error sm:flex-none"
        >
          <IconeExcluir />
          Excluir
        </button>
      </div>
    </li>
  );
}

function ListaCarregando() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Carregando contextos…
      </p>
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((indice) => (
          <div
            key={indice}
            className="space-y-4 rounded-card border border-outline-variant/40 bg-surface-container-lowest p-5"
          >
            <span className="flex gap-3.5">
              <span className="size-10 shrink-0 animate-pulse rounded-control bg-surface-container" />
              <span className="flex-1 space-y-2.5 pt-1">
                <span className="block h-3.5 w-1/2 animate-pulse rounded-pill bg-surface-container" />
                <span className="block h-3 w-3/4 animate-pulse rounded-pill bg-surface-container-low" />
              </span>
            </span>
            <span className="flex gap-2 border-t border-outline-variant/30 pt-3">
              <span className="h-8 w-20 animate-pulse rounded-control bg-surface-container-low" />
              <span className="h-8 w-20 animate-pulse rounded-control bg-surface-container-low" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

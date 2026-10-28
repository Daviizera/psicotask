"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";

import type { Context } from "@/modules/contextos/types/context.types";

import { IconeAlerta, IconeCarregando, IconeExcluir } from "./icones";
import { MENSAGENS, lerCorpoDeErro } from "./respostas";

// Mensagem documentada para o 409 de DELETE /api/contextos/:id.
const MENSAGEM_TAREFAS_VINCULADAS =
  "Não é possível excluir um contexto que possui tarefas vinculadas.";
const ORIENTACAO_TAREFAS_VINCULADAS =
  "Exclua as tarefas deste contexto ou mova-as para outro contexto antes de tentar novamente.";

type Erro = { tipo: "tarefasVinculadas"; mensagem: string } | { tipo: "geral"; mensagem: string };

export function ExcluirContextoDialog({
  contexto,
  onFechar,
  onExcluido,
  onNaoEncontrado,
}: Readonly<{
  contexto: Context;
  onFechar: () => void;
  onExcluido: () => void;
  onNaoEncontrado: () => void;
}>) {
  const router = useRouter();
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<Erro | null>(null);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const excluindoRef = useRef(false);
  const fecharRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => dialog.close();
  }, []);

  function fechar() {
    if (excluindoRef.current) return;
    onFechar();
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    fechar();
  }

  function handleClose(event: SyntheticEvent<HTMLDialogElement>) {
    if (!event.currentTarget.open) onFechar();
  }

  async function handleExcluir() {
    if (excluindoRef.current) return;
    excluindoRef.current = true;
    setExcluindo(true);
    setErro(null);

    let response: Response;
    try {
      response = await fetch(`/api/contextos/${contexto.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
    } catch {
      setErro({ tipo: "geral", mensagem: MENSAGENS.rede });
      excluindoRef.current = false;
      setExcluindo(false);
      return;
    }

    if (response.status === 401) {
      router.replace("/login");
      return;
    }

    excluindoRef.current = false;

    // 204 sem corpo: não interpretar JSON.
    if (response.status === 204) {
      onExcluido();
      return;
    }

    if (response.status === 404) {
      onNaoEncontrado();
      return;
    }

    if (response.status === 409) {
      const corpo = await lerCorpoDeErro(response);
      setErro({
        tipo: "tarefasVinculadas",
        mensagem: typeof corpo.error === "string" ? corpo.error : MENSAGEM_TAREFAS_VINCULADAS,
      });
      setExcluindo(false);
      // O botão de exclusão deixa de existir; o foco segue para a ação de fechar.
      requestAnimationFrame(() => fecharRef.current?.focus());
      return;
    }

    setErro({
      tipo: "geral",
      mensagem: response.status === 403 ? MENSAGENS.origem : MENSAGENS.servidor,
    });
    setExcluindo(false);
  }

  const bloqueado = erro?.tipo === "tarefasVinculadas";

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby="excluir-contexto-titulo"
      aria-describedby="excluir-contexto-descricao"
      onCancel={handleCancel}
      onClose={handleClose}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card border border-outline-variant/30 bg-surface-container-lowest p-0 text-on-surface shadow-[0_20px_25px_-5px_rgba(0,86,150,0.08),0_8px_10px_-6px_rgba(15,23,42,0.06)] backdrop:bg-on-surface/40 backdrop:backdrop-blur-xs"
    >
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex items-start gap-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-error-container/70 text-error">
            <IconeExcluir />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 id="excluir-contexto-titulo" className="text-headline-sm text-on-surface">
              Excluir contexto
            </h2>
            <p
              id="excluir-contexto-descricao"
              className="break-words text-body-md text-on-surface-variant"
            >
              Tem certeza de que deseja excluir o contexto{" "}
              <strong className="font-semibold text-on-surface">“{contexto.nome}”</strong>? Esta
              ação não pode ser desfeita.
            </p>
          </div>
        </div>

        {erro && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-control border border-error/30 bg-error-container px-3.5 py-3 text-body-md text-error"
          >
            <IconeAlerta />
            <div className="space-y-1">
              <p className="font-semibold">{erro.mensagem}</p>
              {erro.tipo === "tarefasVinculadas" && <p>{ORIENTACAO_TAREFAS_VINCULADAS}</p>}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-outline-variant/30 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <button
          ref={fecharRef}
          type="button"
          onClick={fechar}
          disabled={excluindo}
          autoFocus
          className="rounded-control border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-label-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-60"
        >
          {bloqueado ? "Fechar" : "Cancelar"}
        </button>
        {!bloqueado && (
          <button
            type="button"
            onClick={handleExcluir}
            disabled={excluindo}
            aria-busy={excluindo}
            className="flex items-center justify-center gap-2 rounded-control bg-error px-5 py-2.5 text-label-lg text-on-primary shadow-sm transition-colors duration-150 hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-error"
          >
            {excluindo && <IconeCarregando />}
            {excluindo ? "Excluindo…" : "Excluir contexto"}
          </button>
        )}
      </div>
    </dialog>
  );
}

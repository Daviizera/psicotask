"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";

import { IconeAlerta, IconeCarregando, IconeExcluir } from "@/components/contextos/icones";
import type { Appointment } from "@/modules/compromissos/types/appointment.types";

import { MENSAGENS } from "./compromissos";

export function ExcluirCompromissoDialog({
  compromisso,
  onFechar,
  onExcluido,
  onNaoEncontrado,
}: Readonly<{
  compromisso: Appointment;
  onFechar: () => void;
  onExcluido: () => void;
  onNaoEncontrado: () => void;
}>) {
  const router = useRouter();
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const excluindoRef = useRef(false);

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
      response = await fetch(`/api/compromissos/${compromisso.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
    } catch {
      setErro(MENSAGENS.rede);
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

    setErro(response.status === 403 ? MENSAGENS.origem : MENSAGENS.servidor);
    setExcluindo(false);
  }

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby="excluir-compromisso-titulo"
      aria-describedby="excluir-compromisso-descricao"
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
            <h2 id="excluir-compromisso-titulo" className="text-headline-sm text-on-surface">
              Excluir compromisso
            </h2>
            <p
              id="excluir-compromisso-descricao"
              className="break-words text-body-md text-on-surface-variant"
            >
              Tem certeza de que deseja excluir o compromisso{" "}
              <strong className="font-semibold text-on-surface">“{compromisso.titulo}”</strong>?
              Esta ação não pode ser desfeita.
            </p>
          </div>
        </div>

        {erro && (
          <p
            role="alert"
            className="flex items-start gap-2.5 rounded-control border border-error/30 bg-error-container px-3.5 py-3 text-body-md text-error"
          >
            <IconeAlerta />
            <span>{erro}</span>
          </p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-outline-variant/30 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <button
          type="button"
          onClick={fechar}
          disabled={excluindo}
          autoFocus
          className="rounded-control border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-label-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleExcluir}
          disabled={excluindo}
          aria-busy={excluindo}
          className="flex items-center justify-center gap-2 rounded-control bg-error px-5 py-2.5 text-label-lg text-on-primary shadow-sm transition-colors duration-150 hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-error"
        >
          {excluindo && <IconeCarregando />}
          {excluindo ? "Excluindo…" : "Excluir compromisso"}
        </button>
      </div>
    </dialog>
  );
}

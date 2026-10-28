"use client";

import { useEffect, useRef, useState, type FormEvent, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";

import type {
  Context,
  CreateContextInput,
  UpdateContextInput,
} from "@/modules/contextos/types/context.types";

import { IconeAlerta, IconeCarregando, IconeFechar } from "./icones";
import { MENSAGENS, NOME_MAX, ehContexto, lerCorpoDeErro } from "./respostas";

type Campo = "nome" | "descricao";
type ErrosDeCampo = Partial<Record<Campo, string>>;

function lerErrosDeCampo(details: unknown): ErrosDeCampo {
  const erros: ErrosDeCampo = {};
  if (!Array.isArray(details)) return erros;

  for (const item of details) {
    if (typeof item !== "object" || item === null) continue;
    const { path, message } = item as { path?: unknown; message?: unknown };
    if (!Array.isArray(path) || typeof message !== "string") continue;
    const campo: unknown = path[0];
    if ((campo === "nome" || campo === "descricao") && !erros[campo]) {
      erros[campo] = message;
    }
  }
  return erros;
}

// Sem `contexto`: criação. Com `contexto`: edição do item informado.
export function ContextoFormDialog({
  contexto,
  onFechar,
  onSalvo,
  onNaoEncontrado,
}: Readonly<{
  contexto?: Context;
  onFechar: () => void;
  onSalvo: (contexto: Context) => void;
  onNaoEncontrado: () => void;
}>) {
  const router = useRouter();
  const editando = contexto !== undefined;
  const [nome, setNome] = useState(contexto?.nome ?? "");
  const [descricao, setDescricao] = useState(contexto?.descricao ?? "");
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const nomeRef = useRef<HTMLInputElement>(null);
  const descricaoRef = useRef<HTMLTextAreaElement>(null);
  const enviandoRef = useRef(false);

  // <dialog> nativo: torna o restante da página inerte, prende o foco e o
  // devolve ao elemento de origem ao fechar.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => dialog.close();
  }, []);

  function fechar() {
    if (enviandoRef.current) return;
    onFechar();
  }

  // Escape: o fechamento é controlado pelo componente (bloqueado durante o envio).
  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    fechar();
  }

  // O navegador pode fechar o diálogo mesmo com o cancel impedido; mantém o
  // estado da página coerente nesse caso.
  function handleClose(event: SyntheticEvent<HTMLDialogElement>) {
    if (!event.currentTarget.open) onFechar();
  }

  function focarCampo(campo: Campo) {
    (campo === "nome" ? nomeRef : descricaoRef).current?.focus();
  }

  // Edição envia somente os campos alterados; PUT com {} é inválido na API.
  function montarPayload(nomeInformado: string, descricaoInformada: string) {
    if (!contexto) {
      const payload: CreateContextInput = { nome: nomeInformado };
      if (descricaoInformada) payload.descricao = descricaoInformada;
      return payload;
    }
    const payload: UpdateContextInput = {};
    if (nomeInformado !== contexto.nome) payload.nome = nomeInformado;
    // `descricao` não aceita null: "" é a forma aceita de deixá-la em branco.
    if (descricaoInformada !== (contexto.descricao ?? "")) payload.descricao = descricaoInformada;
    return payload;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviandoRef.current) return;

    const nomeInformado = nome.trim();
    const descricaoInformada = descricao.trim();
    const erros: ErrosDeCampo = {};
    if (!nomeInformado) erros.nome = "Informe o nome do contexto.";
    else if (nomeInformado.length > NOME_MAX)
      erros.nome = `O nome deve ter no máximo ${NOME_MAX} caracteres.`;

    setErroGeral(null);
    setErrosDeCampo(erros);
    if (erros.nome) {
      focarCampo("nome");
      return;
    }

    const payload = montarPayload(nomeInformado, descricaoInformada);
    if (Object.keys(payload).length === 0) {
      // Nada mudou na edição: não há o que salvar.
      onFechar();
      return;
    }

    enviandoRef.current = true;
    setEnviando(true);

    let response: Response;
    try {
      response = await fetch(contexto ? `/api/contextos/${contexto.id}` : "/api/contextos", {
        method: contexto ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
    } catch {
      setErroGeral(MENSAGENS.rede);
      enviandoRef.current = false;
      setEnviando(false);
      return;
    }

    if (response.status === 401) {
      router.replace("/login");
      return;
    }

    if (response.ok) {
      const corpo: unknown = await response.json().catch(() => null);
      enviandoRef.current = false;
      if (ehContexto(corpo)) {
        onSalvo(corpo);
        return;
      }
      setErroGeral(MENSAGENS.servidor);
      setEnviando(false);
      return;
    }

    const corpo = await lerCorpoDeErro(response);

    if (response.status === 400) {
      const errosDaApi = lerErrosDeCampo(corpo.details);
      setErrosDeCampo(errosDaApi);
      if (errosDaApi.nome || errosDaApi.descricao) {
        focarCampo(errosDaApi.nome ? "nome" : "descricao");
      } else {
        setErroGeral(typeof corpo.error === "string" ? corpo.error : MENSAGENS.validacao);
      }
    } else if (response.status === 403) {
      setErroGeral(MENSAGENS.origem);
    } else if (response.status === 404 && editando) {
      enviandoRef.current = false;
      onNaoEncontrado();
      return;
    } else {
      setErroGeral(MENSAGENS.servidor);
    }

    enviandoRef.current = false;
    setEnviando(false);
  }

  const classeInput =
    "block w-full rounded-control border bg-surface-container-lowest px-3.5 py-2.5 text-body-lg text-on-surface placeholder:text-outline transition-[border-color,box-shadow] duration-150 focus:outline-none focus:ring-[3px] read-only:cursor-wait";
  const classeInputValido =
    "border-outline-variant hover:border-outline focus:border-primary-container focus:ring-primary-container/20";
  const classeInputInvalido = "border-error focus:border-error focus:ring-error/20";

  const titulo = editando ? "Editar contexto" : "Novo contexto";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="contexto-form-titulo"
      aria-describedby="contexto-form-descricao"
      onCancel={handleCancel}
      onClose={handleClose}
      className="m-0 ml-auto h-full max-h-full w-full max-w-md border-l border-outline-variant/30 bg-surface-container-lowest p-0 text-on-surface shadow-[0_20px_25px_-5px_rgba(0,86,150,0.08),0_8px_10px_-6px_rgba(15,23,42,0.06)] backdrop:bg-on-surface/40 backdrop:backdrop-blur-xs"
    >
      <form noValidate onSubmit={handleSubmit} className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-outline-variant/30 px-5 py-4 sm:px-6">
          <div className="min-w-0 space-y-0.5">
            <h2 id="contexto-form-titulo" className="text-headline-sm text-on-surface">
              {titulo}
            </h2>
            <p id="contexto-form-descricao" className="text-body-sm text-on-surface-variant">
              {editando
                ? "Atualize o nome ou a descrição deste contexto."
                : "Crie uma área da rotina para organizar suas tarefas."}
            </p>
          </div>
          <button
            type="button"
            onClick={fechar}
            disabled={enviando}
            aria-label="Fechar"
            className="-mr-1.5 shrink-0 rounded-control p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-60"
          >
            <IconeFechar />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          {erroGeral && (
            <p
              role="alert"
              className="flex items-start gap-2.5 rounded-control border border-error/30 bg-error-container px-3.5 py-3 text-body-md text-error"
            >
              <IconeAlerta />
              <span>{erroGeral}</span>
            </p>
          )}

          <div className="space-y-1.5">
            <label htmlFor="contexto-nome" className="block text-label-lg text-on-surface">
              Nome
            </label>
            <input
              ref={nomeRef}
              id="contexto-nome"
              name="nome"
              type="text"
              autoFocus
              autoComplete="off"
              maxLength={NOME_MAX}
              required
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              readOnly={enviando}
              aria-invalid={errosDeCampo.nome ? true : undefined}
              aria-describedby={errosDeCampo.nome ? "contexto-nome-erro" : undefined}
              placeholder="Ex.: Estudos"
              className={`${classeInput} ${errosDeCampo.nome ? classeInputInvalido : classeInputValido}`}
            />
            {errosDeCampo.nome && (
              <p id="contexto-nome-erro" role="alert" className="text-body-sm text-error">
                {errosDeCampo.nome}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="contexto-descricao" className="block text-label-lg text-on-surface">
              Descrição <span className="font-normal text-on-surface-variant">(opcional)</span>
            </label>
            <textarea
              ref={descricaoRef}
              id="contexto-descricao"
              name="descricao"
              rows={4}
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
              readOnly={enviando}
              aria-invalid={errosDeCampo.descricao ? true : undefined}
              aria-describedby={errosDeCampo.descricao ? "contexto-descricao-erro" : undefined}
              placeholder="Ex.: Leituras e cursos de atualização"
              className={`${classeInput} resize-y ${errosDeCampo.descricao ? classeInputInvalido : classeInputValido}`}
            />
            {errosDeCampo.descricao && (
              <p id="contexto-descricao-erro" role="alert" className="text-body-sm text-error">
                {errosDeCampo.descricao}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-outline-variant/30 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={fechar}
            disabled={enviando}
            className="rounded-control border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-label-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            aria-busy={enviando}
            className="flex items-center justify-center gap-2 rounded-control bg-primary-container px-5 py-2.5 text-label-lg text-on-primary shadow-sm shadow-primary/20 transition-colors duration-150 hover:bg-primary disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-primary-container"
          >
            {enviando && <IconeCarregando />}
            {enviando ? "Salvando…" : editando ? "Salvar alterações" : "Criar contexto"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

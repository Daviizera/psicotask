"use client";

import { useEffect, useRef, useState, type FormEvent, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";

import { IconeAlerta, IconeCarregando, IconeFechar } from "@/components/contextos/icones";
import { lerCorpoDeErro } from "@/components/contextos/respostas";
import type {
  Appointment,
  AppointmentStatus,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from "@/modules/compromissos/types/appointment.types";

import {
  MENSAGEM_INTERVALO_INVALIDO,
  MENSAGENS,
  ROTULOS_STATUS,
  STATUS,
  TITULO_MAX,
  ehCompromisso,
  ehDataCivil,
  ehHora,
  hojeNaRotina,
} from "./compromissos";

const CAMPOS = ["titulo", "data", "horaInicio", "horaFim", "status", "descricao"] as const;
type Campo = (typeof CAMPOS)[number];
type ErrosDeCampo = Partial<Record<Campo, string>>;

function ehCampo(valor: unknown): valor is Campo {
  return typeof valor === "string" && (CAMPOS as readonly string[]).includes(valor);
}

function lerErrosDeCampo(details: unknown): ErrosDeCampo {
  const erros: ErrosDeCampo = {};
  if (!Array.isArray(details)) return erros;

  for (const item of details) {
    if (typeof item !== "object" || item === null) continue;
    const { path, message } = item as { path?: unknown; message?: unknown };
    if (!Array.isArray(path) || typeof message !== "string") continue;
    const campo: unknown = path[0];
    if (ehCampo(campo) && !erros[campo]) erros[campo] = message;
  }
  return erros;
}

function primeiroCampoComErro(erros: ErrosDeCampo): Campo | undefined {
  return CAMPOS.find((campo) => erros[campo]);
}

// Sem `compromisso`: criação. Com `compromisso`: edição do item informado.
export function CompromissoFormDialog({
  compromisso,
  onFechar,
  onSalvo,
  onNaoEncontrado,
}: Readonly<{
  compromisso?: Appointment;
  onFechar: () => void;
  onSalvo: (compromisso: Appointment) => void;
  onNaoEncontrado: () => void;
}>) {
  const router = useRouter();
  const editando = compromisso !== undefined;

  const [titulo, setTitulo] = useState(compromisso?.titulo ?? "");
  // Na criação, a data começa no dia atual da rotina; os horários ficam vazios.
  const [data, setData] = useState(() => compromisso?.data ?? hojeNaRotina());
  const [horaInicio, setHoraInicio] = useState(compromisso?.horaInicio ?? "");
  const [horaFim, setHoraFim] = useState(compromisso?.horaFim ?? "");
  // Valor inicial da criação segue o default do POST (AGENDADO).
  const [status, setStatus] = useState<AppointmentStatus>(compromisso?.status ?? "AGENDADO");
  const [descricao, setDescricao] = useState(compromisso?.descricao ?? "");
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const tituloRef = useRef<HTMLInputElement>(null);
  const dataRef = useRef<HTMLInputElement>(null);
  const horaInicioRef = useRef<HTMLInputElement>(null);
  const horaFimRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLFieldSetElement>(null);
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

  function handleClose(event: SyntheticEvent<HTMLDialogElement>) {
    if (!event.currentTarget.open) onFechar();
  }

  function focarCampo(campo: Campo) {
    const alvos: Record<Campo, () => void> = {
      titulo: () => tituloRef.current?.focus(),
      data: () => dataRef.current?.focus(),
      horaInicio: () => horaInicioRef.current?.focus(),
      horaFim: () => horaFimRef.current?.focus(),
      status: () => statusRef.current?.querySelector<HTMLInputElement>(":checked")?.focus(),
      descricao: () => descricaoRef.current?.focus(),
    };
    alvos[campo]();
  }

  function validar(tituloInformado: string): ErrosDeCampo {
    const erros: ErrosDeCampo = {};
    if (!tituloInformado) erros.titulo = "Informe o título do compromisso.";
    else if (tituloInformado.length > TITULO_MAX)
      erros.titulo = `O título deve ter no máximo ${TITULO_MAX} caracteres.`;

    // Valor digitado pela metade: o input informa "" com `badInput`.
    if (dataRef.current?.validity.badInput || (data && !ehDataCivil(data)))
      erros.data = "Informe uma data válida, com ano entre 0001 e 9999.";
    else if (!data) erros.data = "Informe a data do compromisso.";

    if (horaInicioRef.current?.validity.badInput || (horaInicio && !ehHora(horaInicio)))
      erros.horaInicio = "Informe uma hora de início válida.";
    else if (!horaInicio) erros.horaInicio = "Informe a hora de início.";

    if (horaFimRef.current?.validity.badInput || (horaFim && !ehHora(horaFim)))
      erros.horaFim = "Informe uma hora de término válida.";
    else if (!horaFim) erros.horaFim = "Informe a hora de término.";
    // HH:mm compara cronologicamente como texto; o fim deve ser maior, no mesmo dia.
    else if (!erros.horaInicio && horaFim <= horaInicio)
      erros.horaFim = MENSAGEM_INTERVALO_INVALIDO;

    return erros;
  }

  // Criação: campos obrigatórios, status escolhido e descrição preenchida.
  // Edição: somente o que mudou, pois PUT com {} é inválido.
  function montarPayload(tituloInformado: string, descricaoInformada: string) {
    if (!compromisso) {
      const payload: CreateAppointmentInput = {
        titulo: tituloInformado,
        data,
        horaInicio,
        horaFim,
        status,
      };
      if (descricaoInformada) payload.descricao = descricaoInformada;
      return payload;
    }
    const payload: UpdateAppointmentInput = {};
    if (tituloInformado !== compromisso.titulo) payload.titulo = tituloInformado;
    if (data !== compromisso.data) payload.data = data;
    // O par validado aqui segue junto: o backend não precisa combiná-lo com
    // um horário persistido que pode ter mudado desde a abertura do formulário.
    if (horaInicio !== compromisso.horaInicio || horaFim !== compromisso.horaFim) {
      payload.horaInicio = horaInicio;
      payload.horaFim = horaFim;
    }
    if (status !== compromisso.status) payload.status = status;
    // `descricao` não aceita null: "" é a forma aceita de deixá-la em branco.
    if (descricaoInformada !== (compromisso.descricao ?? "")) payload.descricao = descricaoInformada;
    return payload;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviandoRef.current) return;

    const tituloInformado = titulo.trim();
    const descricaoInformada = descricao.trim();
    const erros = validar(tituloInformado);

    setErroGeral(null);
    setErrosDeCampo(erros);
    const campoInvalido = primeiroCampoComErro(erros);
    if (campoInvalido) {
      focarCampo(campoInvalido);
      return;
    }

    const payload = montarPayload(tituloInformado, descricaoInformada);
    if (Object.keys(payload).length === 0) {
      // Nada mudou na edição: não há o que salvar.
      onFechar();
      return;
    }

    enviandoRef.current = true;
    setEnviando(true);

    let response: Response;
    try {
      response = await fetch(
        compromisso ? `/api/compromissos/${compromisso.id}` : "/api/compromissos",
        {
          method: compromisso ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        },
      );
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
      if (ehCompromisso(corpo)) {
        onSalvo(corpo);
        return;
      }
      setErroGeral(MENSAGENS.servidor);
      setEnviando(false);
      return;
    }

    const corpo = await lerCorpoDeErro(response);

    if (response.status === 400) {
      // O intervalo inválido chega como details[{ path: ["horaFim"] }].
      const errosDaApi = lerErrosDeCampo(corpo.details);
      setErrosDeCampo(errosDaApi);
      const campoDaApi = primeiroCampoComErro(errosDaApi);
      if (campoDaApi) focarCampo(campoDaApi);
      else setErroGeral(typeof corpo.error === "string" ? corpo.error : MENSAGENS.validacao);
    } else if (response.status === 404 && editando) {
      enviandoRef.current = false;
      onNaoEncontrado();
      return;
    } else if (response.status === 403) {
      setErroGeral(MENSAGENS.origem);
    } else {
      setErroGeral(MENSAGENS.servidor);
    }

    enviandoRef.current = false;
    setEnviando(false);
  }

  const classeInput =
    "block w-full min-w-0 rounded-control border bg-surface-container-lowest px-3.5 py-2.5 text-body-lg text-on-surface placeholder:text-outline transition-[border-color,box-shadow] duration-150 focus:outline-none focus:ring-[3px] read-only:cursor-wait";
  const classeInputValido =
    "border-outline-variant hover:border-outline focus:border-primary-container focus:ring-primary-container/20";
  const classeInputInvalido = "border-error focus:border-error focus:ring-error/20";
  const classeDoCampo = (campo: Campo) =>
    `${classeInput} ${errosDeCampo[campo] ? classeInputInvalido : classeInputValido}`;
  const atributosDeErro = (campo: Campo, ajuda?: string) => ({
    "aria-invalid": errosDeCampo[campo] ? true : undefined,
    "aria-describedby":
      [errosDeCampo[campo] ? `compromisso-${campo}-erro` : "", ajuda ?? ""]
        .filter(Boolean)
        .join(" ") || undefined,
  });

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="compromisso-form-titulo"
      aria-describedby="compromisso-form-descricao"
      onCancel={handleCancel}
      onClose={handleClose}
      className="m-0 ml-auto h-full max-h-full w-full max-w-md border-l border-outline-variant/30 bg-surface-container-lowest p-0 text-on-surface shadow-[0_20px_25px_-5px_rgba(0,86,150,0.08),0_8px_10px_-6px_rgba(15,23,42,0.06)] backdrop:bg-on-surface/40 backdrop:backdrop-blur-xs"
    >
      <form noValidate onSubmit={handleSubmit} className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-outline-variant/30 px-5 py-4 sm:px-6">
          <div className="min-w-0 space-y-0.5">
            <h2 id="compromisso-form-titulo" className="text-headline-sm text-on-surface">
              {editando ? "Editar compromisso" : "Novo compromisso"}
            </h2>
            <p id="compromisso-form-descricao" className="text-body-sm text-on-surface-variant">
              {editando
                ? "Atualize os dados, o horário ou o status deste compromisso."
                : "Registre um compromisso da sua agenda com data e horário."}
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
            <label htmlFor="compromisso-titulo" className="block text-label-lg text-on-surface">
              Título
            </label>
            <input
              ref={tituloRef}
              id="compromisso-titulo"
              name="titulo"
              type="text"
              autoFocus
              autoComplete="off"
              maxLength={TITULO_MAX}
              required
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              readOnly={enviando}
              {...atributosDeErro("titulo")}
              placeholder="Ex.: Supervisão de casos"
              className={classeDoCampo("titulo")}
            />
            <MensagemDeErro campo="titulo" erros={errosDeCampo} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="compromisso-data" className="block text-label-lg text-on-surface">
              Data
            </label>
            <input
              ref={dataRef}
              id="compromisso-data"
              name="data"
              type="date"
              required
              min="0001-01-01"
              max="9999-12-31"
              value={data}
              onChange={(event) => setData(event.target.value)}
              readOnly={enviando}
              {...atributosDeErro("data")}
              className={classeDoCampo("data")}
            />
            <MensagemDeErro campo="data" erros={errosDeCampo} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <label
                htmlFor="compromisso-horaInicio"
                className="block text-label-lg text-on-surface"
              >
                Início
              </label>
              <input
                ref={horaInicioRef}
                id="compromisso-horaInicio"
                name="horaInicio"
                type="time"
                required
                value={horaInicio}
                onChange={(event) => setHoraInicio(event.target.value)}
                readOnly={enviando}
                {...atributosDeErro("horaInicio")}
                className={classeDoCampo("horaInicio")}
              />
              <MensagemDeErro campo="horaInicio" erros={errosDeCampo} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <label htmlFor="compromisso-horaFim" className="block text-label-lg text-on-surface">
                Término
              </label>
              <input
                ref={horaFimRef}
                id="compromisso-horaFim"
                name="horaFim"
                type="time"
                required
                value={horaFim}
                onChange={(event) => setHoraFim(event.target.value)}
                readOnly={enviando}
                {...atributosDeErro("horaFim", "compromisso-horario-ajuda")}
                className={classeDoCampo("horaFim")}
              />
              <MensagemDeErro campo="horaFim" erros={errosDeCampo} />
            </div>
          </div>
          <p id="compromisso-horario-ajuda" className="-mt-3 text-body-sm text-on-surface-variant">
            O término deve ser depois do início, no mesmo dia.
          </p>

          <fieldset
            ref={statusRef}
            disabled={enviando}
            aria-describedby={errosDeCampo.status ? "compromisso-status-erro" : undefined}
            className="space-y-1.5"
          >
            <legend className="mb-1.5 block text-label-lg text-on-surface">Status</legend>
            <div
              className={`flex gap-1 rounded-control border bg-surface-container-low p-1 ${
                errosDeCampo.status ? "border-error" : "border-outline-variant/40"
              }`}
            >
              {STATUS.map((opcao) => (
                <label
                  key={opcao}
                  className="flex flex-1 cursor-pointer items-center justify-center rounded-[0.5rem] px-2 py-1.5 text-center text-label-md text-on-surface-variant transition-colors hover:text-on-surface has-checked:bg-surface-container-lowest has-checked:text-primary has-checked:shadow-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-primary-container has-disabled:cursor-wait"
                >
                  <input
                    type="radio"
                    name="status"
                    value={opcao}
                    checked={status === opcao}
                    onChange={() => setStatus(opcao)}
                    className="sr-only"
                  />
                  {ROTULOS_STATUS[opcao]}
                </label>
              ))}
            </div>
            <MensagemDeErro campo="status" erros={errosDeCampo} />
          </fieldset>

          <div className="space-y-1.5">
            <label htmlFor="compromisso-descricao" className="block text-label-lg text-on-surface">
              Descrição <span className="font-normal text-on-surface-variant">(opcional)</span>
            </label>
            <textarea
              ref={descricaoRef}
              id="compromisso-descricao"
              name="descricao"
              rows={4}
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
              readOnly={enviando}
              {...atributosDeErro("descricao")}
              placeholder="Ex.: Revisar pauta antes da reunião"
              className={`${classeDoCampo("descricao")} resize-y`}
            />
            <MensagemDeErro campo="descricao" erros={errosDeCampo} />
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
            {enviando ? "Salvando…" : editando ? "Salvar alterações" : "Criar compromisso"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function MensagemDeErro({ campo, erros }: Readonly<{ campo: Campo; erros: ErrosDeCampo }>) {
  if (!erros[campo]) return null;
  return (
    <p id={`compromisso-${campo}-erro`} role="alert" className="text-body-sm text-error">
      {erros[campo]}
    </p>
  );
}

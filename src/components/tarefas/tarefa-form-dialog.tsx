"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type Ref,
  type SyntheticEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  IconeAlerta,
  IconeCarregando,
  IconeContexto,
  IconeFechar,
} from "@/components/contextos/icones";
import { lerCorpoDeErro } from "@/components/contextos/respostas";
import type { Context } from "@/modules/contextos/types/context.types";
import type {
  CreateTaskInput,
  Task,
  TaskPriority,
  TaskStatus,
  UpdateTaskInput,
} from "@/modules/tarefas/types/task.types";

import {
  ERRO_CONTEXTO_NAO_ENCONTRADO,
  MENSAGENS,
  PRIORIDADES,
  ROTULOS_PRIORIDADE,
  ROTULOS_STATUS,
  STATUS,
  TITULO_MAX,
  ehDataCivil,
  ehTarefa,
  formatarDataLonga,
} from "./tarefas";

const CAMPOS = ["titulo", "contextoId", "prioridade", "status", "prazo", "descricao"] as const;
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

// Sem `tarefa`: criação (com `statusInicial` opcional). Com `tarefa`: edição.
export function TarefaFormDialog({
  tarefa,
  statusInicial = "PENDENTE",
  contextos,
  onFechar,
  onSalvo,
  onNaoEncontrada,
}: Readonly<{
  tarefa?: Task;
  statusInicial?: TaskStatus;
  contextos: Context[];
  onFechar: () => void;
  onSalvo: (tarefa: Task) => void;
  onNaoEncontrada: () => void;
}>) {
  const router = useRouter();
  const editando = tarefa !== undefined;
  const semContextos = !editando && contextos.length === 0;

  const [titulo, setTitulo] = useState(tarefa?.titulo ?? "");
  // Com um único contexto, ele já vem selecionado na criação.
  const [contextoId, setContextoId] = useState(
    String(tarefa?.contextoId ?? (contextos.length === 1 ? contextos[0].id : "")),
  );
  // Valores iniciais da criação seguem os defaults do POST (MEDIA e PENDENTE).
  const [prioridade, setPrioridade] = useState<TaskPriority>(tarefa?.prioridade ?? "MEDIA");
  const [status, setStatus] = useState<TaskStatus>(tarefa?.status ?? statusInicial);
  const [prazo, setPrazo] = useState(tarefa?.prazo ?? "");
  const [descricao, setDescricao] = useState(tarefa?.descricao ?? "");
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const tituloRef = useRef<HTMLInputElement>(null);
  const contextoRef = useRef<HTMLSelectElement>(null);
  const prioridadeRef = useRef<HTMLFieldSetElement>(null);
  const statusRef = useRef<HTMLFieldSetElement>(null);
  const prazoRef = useRef<HTMLInputElement>(null);
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
      contextoId: () => contextoRef.current?.focus(),
      prioridade: () => prioridadeRef.current?.querySelector<HTMLInputElement>(":checked")?.focus(),
      status: () => statusRef.current?.querySelector<HTMLInputElement>(":checked")?.focus(),
      prazo: () => prazoRef.current?.focus(),
      descricao: () => descricaoRef.current?.focus(),
    };
    alvos[campo]();
  }

  function validar(tituloInformado: string, prazoIncompleto: boolean): ErrosDeCampo {
    const erros: ErrosDeCampo = {};
    if (!tituloInformado) erros.titulo = "Informe o título da tarefa.";
    else if (tituloInformado.length > TITULO_MAX)
      erros.titulo = `O título deve ter no máximo ${TITULO_MAX} caracteres.`;

    if (!contextos.some((contexto) => String(contexto.id) === contextoId))
      erros.contextoId = "Selecione o contexto da tarefa.";

    if (prazoIncompleto || (prazo && !ehDataCivil(prazo)))
      erros.prazo = "Informe uma data válida, com ano entre 0001 e 9999.";
    // A API não aceita null e omitir `prazo` não o remove.
    else if (tarefa?.prazo && !prazo)
      erros.prazo = "Um prazo já definido não pode ser removido. Mantenha-o ou escolha outra data.";

    return erros;
  }

  // Criação: campos obrigatórios, prioridade e status escolhidos e opcionais
  // preenchidos. Edição: somente o que mudou, pois PUT com {} é inválido.
  function montarPayload(tituloInformado: string, descricaoInformada: string) {
    const contextoSelecionado = Number(contextoId);
    if (!tarefa) {
      const payload: CreateTaskInput = {
        titulo: tituloInformado,
        contextoId: contextoSelecionado,
        prioridade,
        status,
      };
      if (descricaoInformada) payload.descricao = descricaoInformada;
      if (prazo) payload.prazo = prazo;
      return payload;
    }
    const payload: UpdateTaskInput = {};
    if (tituloInformado !== tarefa.titulo) payload.titulo = tituloInformado;
    if (contextoSelecionado !== tarefa.contextoId) payload.contextoId = contextoSelecionado;
    if (prioridade !== tarefa.prioridade) payload.prioridade = prioridade;
    if (status !== tarefa.status) payload.status = status;
    if (prazo && prazo !== tarefa.prazo) payload.prazo = prazo;
    // `descricao` não aceita null: "" é a forma aceita de deixá-la em branco.
    if (descricaoInformada !== (tarefa.descricao ?? "")) payload.descricao = descricaoInformada;
    return payload;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviandoRef.current || semContextos) return;

    const tituloInformado = titulo.trim();
    const descricaoInformada = descricao.trim();
    // Data digitada pela metade: o input informa "" com `badInput`.
    const erros = validar(tituloInformado, prazoRef.current?.validity.badInput ?? false);

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
      response = await fetch(tarefa ? `/api/tarefas/${tarefa.id}` : "/api/tarefas", {
        method: tarefa ? "PUT" : "POST",
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
      if (ehTarefa(corpo)) {
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
      const campoDaApi = primeiroCampoComErro(errosDaApi);
      if (campoDaApi) focarCampo(campoDaApi);
      else setErroGeral(typeof corpo.error === "string" ? corpo.error : MENSAGENS.validacao);
    } else if (response.status === 404) {
      // POST: só o contexto pode não existir. PUT: tarefa ou contexto, distinguidos pela mensagem.
      if (!editando || corpo.error === ERRO_CONTEXTO_NAO_ENCONTRADO) {
        setErrosDeCampo({ contextoId: MENSAGENS.contextoNaoEncontrado });
        focarCampo("contextoId");
      } else {
        enviandoRef.current = false;
        onNaoEncontrada();
        return;
      }
    } else if (response.status === 403) {
      setErroGeral(MENSAGENS.origem);
    } else {
      setErroGeral(MENSAGENS.servidor);
    }

    enviandoRef.current = false;
    setEnviando(false);
  }

  const classeInput =
    "block w-full rounded-control border bg-surface-container-lowest px-3.5 py-2.5 text-body-lg text-on-surface placeholder:text-outline transition-[border-color,box-shadow] duration-150 focus:outline-none focus:ring-[3px] read-only:cursor-wait disabled:cursor-wait disabled:opacity-70";
  const classeInputValido =
    "border-outline-variant hover:border-outline focus:border-primary-container focus:ring-primary-container/20";
  const classeInputInvalido = "border-error focus:border-error focus:ring-error/20";
  const classeDoCampo = (campo: Campo) =>
    `${classeInput} ${errosDeCampo[campo] ? classeInputInvalido : classeInputValido}`;
  const descritoPor = (campo: Campo, ...extras: string[]) =>
    [errosDeCampo[campo] ? `tarefa-${campo}-erro` : "", ...extras].filter(Boolean).join(" ") ||
    undefined;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="tarefa-form-titulo"
      aria-describedby="tarefa-form-descricao"
      onCancel={handleCancel}
      onClose={handleClose}
      className="m-0 ml-auto h-full max-h-full w-full max-w-md border-l border-outline-variant/30 bg-surface-container-lowest p-0 text-on-surface shadow-[0_20px_25px_-5px_rgba(0,86,150,0.08),0_8px_10px_-6px_rgba(15,23,42,0.06)] backdrop:bg-on-surface/40 backdrop:backdrop-blur-xs"
    >
      <form noValidate onSubmit={handleSubmit} className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-outline-variant/30 px-5 py-4 sm:px-6">
          <div className="min-w-0 space-y-0.5">
            <h2 id="tarefa-form-titulo" className="text-headline-sm text-on-surface">
              {editando ? "Editar tarefa" : "Nova tarefa"}
            </h2>
            <p id="tarefa-form-descricao" className="text-body-sm text-on-surface-variant">
              {tarefa
                ? `Criada em ${formatarDataLonga(tarefa.dataCriacao)}.`
                : "Registre uma tarefa e associe-a a um contexto da sua rotina."}
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

        {semContextos ? (
          <div className="flex flex-1 flex-col items-center gap-3 overflow-y-auto px-5 py-12 text-center sm:px-6">
            <span className="flex size-12 items-center justify-center rounded-pill bg-surface-container-low text-outline">
              <IconeContexto />
            </span>
            <p className="text-label-lg text-on-surface">Cadastre um contexto primeiro</p>
            <p className="max-w-xs text-body-md text-on-surface-variant">
              Toda tarefa pertence a um contexto, como estudos, supervisão ou administração. Crie
              um contexto para depois cadastrar suas tarefas.
            </p>
            <Link
              href="/contextos"
              autoFocus
              className="mt-2 flex items-center justify-center gap-2 rounded-control bg-primary-container px-4 py-2.5 text-label-lg text-on-primary shadow-sm shadow-primary/20 transition-colors duration-150 hover:bg-primary"
            >
              Ir para Contextos
            </Link>
          </div>
        ) : (
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
              <label htmlFor="tarefa-titulo" className="block text-label-lg text-on-surface">
                Título
              </label>
              <input
                ref={tituloRef}
                id="tarefa-titulo"
                name="titulo"
                type="text"
                autoFocus
                autoComplete="off"
                maxLength={TITULO_MAX}
                required
                value={titulo}
                onChange={(event) => setTitulo(event.target.value)}
                readOnly={enviando}
                aria-invalid={errosDeCampo.titulo ? true : undefined}
                aria-describedby={descritoPor("titulo")}
                placeholder="Ex.: Revisar planejamento da semana"
                className={classeDoCampo("titulo")}
              />
              <MensagemDeErro campo="titulo" erros={errosDeCampo} />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="tarefa-contextoId" className="block text-label-lg text-on-surface">
                Contexto
              </label>
              <select
                ref={contextoRef}
                id="tarefa-contextoId"
                name="contextoId"
                required
                value={contextoId}
                onChange={(event) => setContextoId(event.target.value)}
                disabled={enviando}
                aria-invalid={errosDeCampo.contextoId ? true : undefined}
                aria-describedby={descritoPor("contextoId")}
                className={classeDoCampo("contextoId")}
              >
                <option value="" disabled>
                  Selecione um contexto
                </option>
                {contextos.map((contexto) => (
                  <option key={contexto.id} value={String(contexto.id)}>
                    {contexto.nome}
                  </option>
                ))}
              </select>
              <MensagemDeErro campo="contextoId" erros={errosDeCampo} />
            </div>

            <ControleSegmentado
              ref={prioridadeRef}
              campo="prioridade"
              legenda="Prioridade"
              opcoes={PRIORIDADES.map((valor) => ({ valor, rotulo: ROTULOS_PRIORIDADE[valor] }))}
              valor={prioridade}
              onChange={setPrioridade}
              desabilitado={enviando}
              erros={errosDeCampo}
            />

            <ControleSegmentado
              ref={statusRef}
              campo="status"
              legenda="Status"
              opcoes={STATUS.map((valor) => ({ valor, rotulo: ROTULOS_STATUS[valor] }))}
              valor={status}
              onChange={setStatus}
              desabilitado={enviando}
              erros={errosDeCampo}
            />

            <div className="space-y-1.5">
              <label htmlFor="tarefa-prazo" className="block text-label-lg text-on-surface">
                Prazo{" "}
                {!tarefa?.prazo && (
                  <span className="font-normal text-on-surface-variant">(opcional)</span>
                )}
              </label>
              <input
                ref={prazoRef}
                id="tarefa-prazo"
                name="prazo"
                type="date"
                min="0001-01-01"
                max="9999-12-31"
                value={prazo}
                onChange={(event) => setPrazo(event.target.value)}
                readOnly={enviando}
                aria-invalid={errosDeCampo.prazo ? true : undefined}
                aria-describedby={descritoPor("prazo", tarefa?.prazo ? "tarefa-prazo-ajuda" : "")}
                className={classeDoCampo("prazo")}
              />
              {tarefa?.prazo && (
                <p id="tarefa-prazo-ajuda" className="text-body-sm text-on-surface-variant">
                  O prazo definido pode ser alterado, mas ainda não pode ser removido.
                </p>
              )}
              <MensagemDeErro campo="prazo" erros={errosDeCampo} />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="tarefa-descricao" className="block text-label-lg text-on-surface">
                Descrição <span className="font-normal text-on-surface-variant">(opcional)</span>
              </label>
              <textarea
                ref={descricaoRef}
                id="tarefa-descricao"
                name="descricao"
                rows={4}
                value={descricao}
                onChange={(event) => setDescricao(event.target.value)}
                readOnly={enviando}
                aria-invalid={errosDeCampo.descricao ? true : undefined}
                aria-describedby={descritoPor("descricao")}
                placeholder="Ex.: Organizar leituras e pendências administrativas"
                className={`${classeDoCampo("descricao")} resize-y`}
              />
              <MensagemDeErro campo="descricao" erros={errosDeCampo} />
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-outline-variant/30 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={fechar}
            disabled={enviando}
            className="rounded-control border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-label-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-60"
          >
            {semContextos ? "Fechar" : "Cancelar"}
          </button>
          {!semContextos && (
            <button
              type="submit"
              disabled={enviando}
              aria-busy={enviando}
              className="flex items-center justify-center gap-2 rounded-control bg-primary-container px-5 py-2.5 text-label-lg text-on-primary shadow-sm shadow-primary/20 transition-colors duration-150 hover:bg-primary disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-primary-container"
            >
              {enviando && <IconeCarregando />}
              {enviando ? "Salvando…" : editando ? "Salvar alterações" : "Criar tarefa"}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}

function MensagemDeErro({ campo, erros }: Readonly<{ campo: Campo; erros: ErrosDeCampo }>) {
  if (!erros[campo]) return null;
  return (
    <p id={`tarefa-${campo}-erro`} role="alert" className="text-body-sm text-error">
      {erros[campo]}
    </p>
  );
}

// Grupo de rádios nativos com aparência de controle segmentado.
function ControleSegmentado<Valor extends string>({
  ref,
  campo,
  legenda,
  opcoes,
  valor,
  onChange,
  desabilitado,
  erros,
}: Readonly<{
  ref: Ref<HTMLFieldSetElement>;
  campo: Campo;
  legenda: string;
  opcoes: { valor: Valor; rotulo: string }[];
  valor: Valor;
  onChange: (valor: Valor) => void;
  desabilitado: boolean;
  erros: ErrosDeCampo;
}>) {
  return (
    <fieldset
      ref={ref}
      disabled={desabilitado}
      aria-describedby={erros[campo] ? `tarefa-${campo}-erro` : undefined}
      className="space-y-1.5"
    >
      <legend className="mb-1.5 block text-label-lg text-on-surface">{legenda}</legend>
      <div
        className={`flex gap-1 rounded-control border bg-surface-container-low p-1 ${
          erros[campo] ? "border-error" : "border-outline-variant/40"
        }`}
      >
        {opcoes.map((opcao) => (
          <label
            key={opcao.valor}
            className="flex flex-1 cursor-pointer items-center justify-center rounded-[0.5rem] px-2 py-1.5 text-center text-label-md text-on-surface-variant transition-colors hover:text-on-surface has-checked:bg-surface-container-lowest has-checked:text-primary has-checked:shadow-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-primary-container has-disabled:cursor-wait"
          >
            <input
              type="radio"
              name={campo}
              value={opcao.valor}
              checked={valor === opcao.valor}
              onChange={() => onChange(opcao.valor)}
              className="sr-only"
            />
            {opcao.rotulo}
          </label>
        ))}
      </div>
      <MensagemDeErro campo={campo} erros={erros} />
    </fieldset>
  );
}

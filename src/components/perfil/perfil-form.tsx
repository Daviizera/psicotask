"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { IconeAlerta, IconeCarregando } from "@/components/contextos/icones";
import { lerCorpoDeErro } from "@/components/contextos/respostas";
import type {
  Psychologist,
  UpdatePsychologistInput,
} from "@/modules/psicologos/types/psychologist.types";

import { LIMITES, MENSAGENS, ehPerfil } from "./perfil";

const CAMPOS = ["nome", "email", "registroProfissional"] as const;
type Campo = (typeof CAMPOS)[number];
type ErrosDeCampo = Partial<Record<Campo, string>>;

// Validação mínima de formato; a API (z.email) é a autoridade final.
const PADRAO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// O 409 de PUT /api/perfil tem uma única mensagem para os dois campos únicos.
const MENSAGENS_DE_CONFLITO: Record<"email" | "registroProfissional", string> = {
  email: "Este e-mail já está cadastrado para outro profissional.",
  registroProfissional: "Este registro profissional já está cadastrado para outro profissional.",
};

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

export function PerfilForm({
  perfil,
  onSalvo,
}: Readonly<{ perfil: Psychologist; onSalvo: (perfil: Psychologist) => void }>) {
  const router = useRouter();
  const [valores, setValores] = useState<Record<Campo, string>>({
    nome: perfil.nome,
    email: perfil.email,
    registroProfissional: perfil.registroProfissional,
  });
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Hooks sempre no nível superior: um objeto literal com chamadas de useRef
  // foi memoizado pelo React Compiler e só executava esses Hooks no 1º render.
  const nomeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const registroProfissionalRef = useRef<HTMLInputElement>(null);
  const enviandoRef = useRef(false);

  const alterado = CAMPOS.some((campo) => valores[campo] !== perfil[campo]);

  function refDoCampo(campo: Campo) {
    if (campo === "nome") return nomeRef;
    if (campo === "email") return emailRef;
    return registroProfissionalRef;
  }

  function focarCampo(campo: Campo) {
    refDoCampo(campo).current?.focus();
  }

  function alterar(campo: Campo, valor: string) {
    setValores((atual) => ({ ...atual, [campo]: valor }));
    setAviso(null);
  }

  function desfazer() {
    setValores({
      nome: perfil.nome,
      email: perfil.email,
      registroProfissional: perfil.registroProfissional,
    });
    setErrosDeCampo({});
    setErroGeral(null);
    setAviso(null);
  }

  function validar(informados: Record<Campo, string>): ErrosDeCampo {
    const erros: ErrosDeCampo = {};
    if (!informados.nome) erros.nome = "Informe seu nome.";
    else if (informados.nome.length > LIMITES.nome)
      erros.nome = `O nome deve ter no máximo ${LIMITES.nome} caracteres.`;

    if (!informados.email) erros.email = "Informe seu e-mail.";
    else if (informados.email.length > LIMITES.email)
      erros.email = `O e-mail deve ter no máximo ${LIMITES.email} caracteres.`;
    else if (!PADRAO_EMAIL.test(informados.email))
      erros.email = "Informe um e-mail válido, como nome@exemplo.com.";

    if (!informados.registroProfissional)
      erros.registroProfissional = "Informe seu registro profissional.";
    else if (informados.registroProfissional.length > LIMITES.registroProfissional)
      erros.registroProfissional = `O registro profissional deve ter no máximo ${LIMITES.registroProfissional} caracteres.`;

    return erros;
  }

  // Somente o que mudou, pois PUT com {} é inválido.
  function montarPayload(informados: Record<Campo, string>): UpdatePsychologistInput {
    const payload: UpdatePsychologistInput = {};
    for (const campo of CAMPOS) {
      if (informados[campo] !== perfil[campo]) payload[campo] = informados[campo];
    }
    return payload;
  }

  // Como só os campos alterados são enviados, o campo em conflito é
  // identificável quando apenas um dos campos únicos fez parte do PUT.
  function errosDeConflito(payload: UpdatePsychologistInput): ErrosDeCampo {
    const enviados = (["email", "registroProfissional"] as const).filter(
      (campo) => payload[campo] !== undefined,
    );
    if (enviados.length === 1) return { [enviados[0]]: MENSAGENS_DE_CONFLITO[enviados[0]] };
    return {
      email: "O e-mail ou o registro profissional já está cadastrado para outro profissional.",
      registroProfissional:
        "O e-mail ou o registro profissional já está cadastrado para outro profissional.",
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviandoRef.current) return;

    const informados: Record<Campo, string> = {
      nome: valores.nome.trim(),
      email: valores.email.trim(),
      registroProfissional: valores.registroProfissional.trim(),
    };
    const erros = validar(informados);

    setErroGeral(null);
    setAviso(null);
    setErrosDeCampo(erros);
    const campoInvalido = primeiroCampoComErro(erros);
    if (campoInvalido) {
      focarCampo(campoInvalido);
      return;
    }

    const payload = montarPayload(informados);
    if (Object.keys(payload).length === 0) {
      // Nada mudou (ou só espaços nas pontas): não há o que salvar.
      setValores(informados);
      setAviso("Nenhuma alteração para salvar.");
      return;
    }

    enviandoRef.current = true;
    setEnviando(true);

    let response: Response;
    try {
      response = await fetch("/api/perfil", {
        method: "PUT",
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
      setEnviando(false);
      if (ehPerfil(corpo)) {
        setValores({
          nome: corpo.nome,
          email: corpo.email,
          registroProfissional: corpo.registroProfissional,
        });
        setAviso("Perfil atualizado.");
        onSalvo(corpo);
      } else {
        setErroGeral(MENSAGENS.servidor);
      }
      return;
    }

    const corpo = await lerCorpoDeErro(response);

    if (response.status === 400) {
      const errosDaApi = lerErrosDeCampo(corpo.details);
      setErrosDeCampo(errosDaApi);
      const campoDaApi = primeiroCampoComErro(errosDaApi);
      if (campoDaApi) focarCampo(campoDaApi);
      else setErroGeral(typeof corpo.error === "string" ? corpo.error : MENSAGENS.validacao);
    } else if (response.status === 409) {
      // Os valores digitados são mantidos para correção.
      const conflitos = errosDeConflito(payload);
      setErrosDeCampo(conflitos);
      const campoEmConflito = primeiroCampoComErro(conflitos);
      if (campoEmConflito) focarCampo(campoEmConflito);
    } else if (response.status === 403) {
      setErroGeral(MENSAGENS.origem);
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

  const definicoes: {
    campo: Campo;
    rotulo: string;
    tipo: "text" | "email";
    autoComplete: string;
    ajuda?: string;
  }[] = [
    { campo: "nome", rotulo: "Nome", tipo: "text", autoComplete: "name" },
    {
      campo: "email",
      rotulo: "E-mail",
      tipo: "email",
      autoComplete: "email",
      ajuda: "Este é também o e-mail usado para entrar no PsicoTask.",
    },
    {
      campo: "registroProfissional",
      rotulo: "Registro profissional",
      tipo: "text",
      autoComplete: "off",
    },
  ];

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-5">
      {erroGeral && (
        <p
          role="alert"
          className="flex items-start gap-2.5 rounded-control border border-error/30 bg-error-container px-3.5 py-3 text-body-md text-error"
        >
          <IconeAlerta />
          <span>{erroGeral}</span>
        </p>
      )}

      {definicoes.map(({ campo, rotulo, tipo, autoComplete, ajuda }) => {
        const erro = errosDeCampo[campo];
        const descritoPor = [erro ? `perfil-${campo}-erro` : "", ajuda ? `perfil-${campo}-ajuda` : ""]
          .filter(Boolean)
          .join(" ");
        return (
          <div key={campo} className="space-y-1.5">
            <label htmlFor={`perfil-${campo}`} className="block text-label-lg text-on-surface">
              {rotulo}
            </label>
            <input
              ref={refDoCampo(campo)}
              id={`perfil-${campo}`}
              name={campo}
              type={tipo}
              autoComplete={autoComplete}
              maxLength={LIMITES[campo]}
              required
              value={valores[campo]}
              onChange={(event) => alterar(campo, event.target.value)}
              readOnly={enviando}
              aria-invalid={erro ? true : undefined}
              aria-describedby={descritoPor || undefined}
              className={`${classeInput} ${erro ? classeInputInvalido : classeInputValido}`}
            />
            {ajuda && (
              <p id={`perfil-${campo}-ajuda`} className="text-body-sm text-on-surface-variant">
                {ajuda}
              </p>
            )}
            {erro && (
              <p id={`perfil-${campo}-erro`} role="alert" className="text-body-sm text-error">
                {erro}
              </p>
            )}
          </div>
        );
      })}

      <div className="flex flex-col-reverse gap-3 border-t border-outline-variant/30 pt-5 sm:flex-row sm:items-center sm:justify-between">
        {/* Região sempre presente para que o leitor de tela anuncie a mudança. */}
        <p aria-live="polite" className="text-body-md text-tertiary">
          {aviso}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
          <button
            type="button"
            onClick={desfazer}
            disabled={enviando || !alterado}
            className="rounded-control border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-label-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-surface-container-lowest"
          >
            Desfazer alterações
          </button>
          <button
            type="submit"
            disabled={enviando}
            aria-busy={enviando}
            className="flex items-center justify-center gap-2 rounded-control bg-primary-container px-5 py-2.5 text-label-lg text-on-primary shadow-sm shadow-primary/20 transition-colors duration-150 hover:bg-primary disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-primary-container"
          >
            {enviando && <IconeCarregando />}
            {enviando ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </form>
  );
}

"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

// Destino após o login: homepage autenticada (Resumo da rotina).
const DESTINO_APOS_LOGIN = "/";

type Campo = "email" | "senha";
type ErrosDeCampo = Partial<Record<Campo, string>>;

const MENSAGENS = {
  credenciais: "E-mail ou senha inválidos.",
  validacao: "Verifique os dados informados.",
  origem:
    "Não foi possível validar a origem da requisição. Recarregue a página e tente novamente.",
  servidor: "Ocorreu um erro inesperado. Tente novamente em instantes.",
  rede: "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
} as const;

// Corpo de erro documentado em docs/frontend-handoff.md: { error, details? }.
type CorpoDeErro = {
  error?: unknown;
  details?: unknown;
};

function lerErrosDeCampo(details: unknown): ErrosDeCampo {
  const erros: ErrosDeCampo = {};
  if (!Array.isArray(details)) return erros;

  for (const item of details) {
    if (typeof item !== "object" || item === null) continue;
    const { path, message } = item as { path?: unknown; message?: unknown };
    if (!Array.isArray(path) || typeof message !== "string") continue;
    const campo: unknown = path[0];
    if ((campo === "email" || campo === "senha") && !erros[campo]) {
      erros[campo] = message;
    }
  }
  return erros;
}

async function lerCorpoDeErro(response: Response): Promise<CorpoDeErro> {
  try {
    const corpo: unknown = await response.json();
    return typeof corpo === "object" && corpo !== null ? (corpo as CorpoDeErro) : {};
  } catch {
    return {};
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviandoRef = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const senhaRef = useRef<HTMLInputElement>(null);

  // Usuário com sessão válida não precisa ver o formulário.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/me", { credentials: "same-origin", signal: controller.signal })
      .then((response) => {
        if (response.ok) router.replace(DESTINO_APOS_LOGIN);
      })
      .catch(() => {
        // Sem sessão confirmada: o formulário permanece disponível.
      });
    return () => controller.abort();
  }, [router]);

  function focarCampo(campo: Campo) {
    (campo === "email" ? emailRef : senhaRef).current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviandoRef.current) return;

    const emailInformado = email.trim();
    // A senha é enviada exatamente como digitada: espaços fazem parte dela.
    const erros: ErrosDeCampo = {};
    if (!emailInformado) erros.email = "Informe seu e-mail.";
    if (!senha) erros.senha = "Informe sua senha.";

    setErroGeral(null);
    setErrosDeCampo(erros);
    if (erros.email || erros.senha) {
      focarCampo(erros.email ? "email" : "senha");
      return;
    }

    enviandoRef.current = true;
    setEnviando(true);

    let response: Response;
    try {
      response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: emailInformado, senha }),
      });
    } catch {
      setErroGeral(MENSAGENS.rede);
      enviandoRef.current = false;
      setEnviando(false);
      return;
    }

    if (response.ok) {
      // O cookie de sessão é gerenciado pelo navegador; mantém o botão
      // desabilitado até a navegação concluir.
      router.replace(DESTINO_APOS_LOGIN);
      return;
    }

    const corpo = await lerCorpoDeErro(response);

    if (response.status === 401) {
      setErroGeral(MENSAGENS.credenciais);
      focarCampo("senha");
    } else if (response.status === 400) {
      const errosDaApi = lerErrosDeCampo(corpo.details);
      setErrosDeCampo(errosDaApi);
      if (errosDaApi.email || errosDaApi.senha) {
        focarCampo(errosDaApi.email ? "email" : "senha");
      } else {
        setErroGeral(MENSAGENS.validacao);
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
    "block w-full rounded-control border bg-surface-container-lowest px-3.5 py-2.5 text-body-lg text-on-surface placeholder:text-outline transition-[border-color,box-shadow] duration-150 focus:outline-none focus:ring-[3px] read-only:cursor-wait";
  const classeInputValido =
    "border-outline-variant hover:border-outline focus:border-primary-container focus:ring-primary-container/20";
  const classeInputInvalido = "border-error focus:border-error focus:ring-error/20";

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-card border border-outline-variant/50 bg-surface-container-lowest shadow-[0_10px_15px_-3px_rgba(15,23,42,0.07),0_4px_6px_-4px_rgba(15,23,42,0.05)] lg:grid-cols-2">
        <section className="hidden flex-col justify-between gap-10 bg-primary p-10 text-on-primary lg:flex"
        >
          <div className="flex items-center gap-3">
            <MarcaPsicoTask />
            <span className="text-headline-md font-bold tracking-tight">PsicoTask</span>
          </div>

          <div className="space-y-4">
            <p className="text-headline-lg text-on-primary">
              Sua rotina profissional, organizada com calma.
            </p>
            <p className="text-body-lg text-primary-fixed">
              Contextos, tarefas e compromissos reunidos em um só lugar.
            </p>
          </div>

          <ul className="space-y-3 text-body-md text-primary-fixed">
            <li className="flex items-center gap-3">
              <span className="size-2 rounded-pill bg-primary-fixed-dim" />
              Tarefas acompanhadas por status e prioridade
            </li>
            <li className="flex items-center gap-3">
              <span className="size-2 rounded-pill bg-tertiary-fixed" />
              Compromissos organizados por data e horário
            </li>
            <li className="flex items-center gap-3">
              <span className="size-2 rounded-pill bg-secondary-container" />
              Resumo da rotina sempre à mão
            </li>
          </ul>
        </section>

        <section className="p-6 sm:p-10">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <MarcaPsicoTask />
            <span className="text-headline-md font-bold tracking-tight text-primary">
              PsicoTask
            </span>
          </div>

          <header className="mb-8 space-y-2">
            <h1 className="text-headline-lg-mobile text-on-surface sm:text-headline-lg">
              Entrar
            </h1>
            <p className="text-body-md text-on-surface-variant">
              Acesse sua conta para organizar sua rotina profissional.
            </p>
          </header>

          <div className="mb-6 empty:mb-0">
            {erroGeral && (
              <p
                role="alert"
                className="flex items-start gap-2.5 rounded-control border border-error/30 bg-error-container px-3.5 py-3 text-body-md text-error"
              >
                <IconeAlerta />
                <span>{erroGeral}</span>
              </p>
            )}
          </div>

          <form noValidate onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-label-lg text-on-surface">
                E-mail
              </label>
              <input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={254}
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                readOnly={enviando}
                aria-invalid={errosDeCampo.email ? true : undefined}
                aria-describedby={errosDeCampo.email ? "email-erro" : undefined}
                placeholder="voce@exemplo.com"
                className={`${classeInput} ${errosDeCampo.email ? classeInputInvalido : classeInputValido}`}
              />
              {errosDeCampo.email && (
                <p id="email-erro" className="text-body-sm text-error">
                  {errosDeCampo.email}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="senha" className="block text-label-lg text-on-surface">
                Senha
              </label>
              <input
                ref={senhaRef}
                id="senha"
                name="senha"
                type="password"
                autoComplete="current-password"
                maxLength={1024}
                required
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                readOnly={enviando}
                aria-invalid={errosDeCampo.senha ? true : undefined}
                aria-describedby={errosDeCampo.senha ? "senha-erro" : undefined}
                className={`${classeInput} ${errosDeCampo.senha ? classeInputInvalido : classeInputValido}`}
              />
              {errosDeCampo.senha && (
                <p id="senha-erro" className="text-body-sm text-error">
                  {errosDeCampo.senha}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={enviando}
              aria-busy={enviando}
              className="flex w-full items-center justify-center gap-2 rounded-control bg-primary-container px-4 py-3 text-label-lg text-on-primary shadow-sm shadow-primary/20 transition-colors duration-150 hover:bg-primary active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-primary-container disabled:active:scale-100"
            >
              {enviando && <IconeCarregando />}
              {enviando ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function MarcaPsicoTask() {
  return (
    <span
      aria-hidden="true"
      className="flex size-10 items-center justify-center rounded-control bg-linear-to-tr from-primary-container to-primary-fixed-dim text-on-primary shadow-sm ring-1 ring-white/10"
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-5">
        <path
          d="M9 11.5l2 2 4-4.5M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
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

function IconeCarregando() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-4 animate-spin">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

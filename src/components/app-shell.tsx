"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import type { Psychologist } from "@/modules/psicologos/types/psychologist.types";

type ItemDeNavegacao = {
  rotulo: string;
  // Título exibido no header quando a rota está ativa.
  titulo: string;
  // Sem href: área ainda não implementada, exibida como indisponível.
  href?: string;
  icone: ReactNode;
};

const NAVEGACAO: ItemDeNavegacao[] = [
  { rotulo: "Resumo", titulo: "Resumo da rotina", href: "/", icone: <IconeResumo /> },
  { rotulo: "Tarefas", titulo: "Tarefas", href: "/tarefas", icone: <IconeTarefas /> },
  {
    rotulo: "Compromissos",
    titulo: "Compromissos",
    href: "/compromissos",
    icone: <IconeCompromissos />,
  },
  { rotulo: "Contextos", titulo: "Contextos", href: "/contextos", icone: <IconeContextos /> },
  { rotulo: "Perfil", titulo: "Perfil", icone: <IconePerfil /> },
];

type EstadoDoPerfil =
  | { tipo: "carregando" }
  | { tipo: "carregado"; psicologo: Psychologist }
  | { tipo: "erro" };

// Perfil público de /api/auth/me compartilhado com as páginas do shell.
const PsicologoContext = createContext<Psychologist | null>(null);

export function usePsicologoAutenticado(): Psychologist | null {
  return useContext(PsicologoContext);
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const [perfil, setPerfil] = useState<EstadoDoPerfil>({ tipo: "carregando" });
  const [menuAberto, setMenuAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [erroAoSair, setErroAoSair] = useState(false);

  const botaoMenuRef = useRef<HTMLButtonElement>(null);
  const botaoFecharRef = useRef<HTMLButtonElement>(null);

  const itemAtivo = NAVEGACAO.find((item) => item.href === pathname);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/me", { credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) {
          setPerfil({ tipo: "erro" });
          return;
        }
        const psicologo = (await response.json()) as Psychologist;
        setPerfil({ tipo: "carregado", psicologo });
      })
      .catch(() => {
        if (!controller.signal.aborted) setPerfil({ tipo: "erro" });
      });
    return () => controller.abort();
  }, [router]);

  // Navegação móvel: Escape fecha e o foco é levado para dentro do painel.
  useEffect(() => {
    if (!menuAberto) return;
    botaoFecharRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMenuAberto(false);
      botaoMenuRef.current?.focus();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuAberto]);

  function fecharMenu() {
    setMenuAberto(false);
    botaoMenuRef.current?.focus();
  }

  async function handleLogout() {
    if (saindo) return;
    setSaindo(true);
    setErroAoSair(false);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      // 401: a sessão já não é válida, então o usuário já está efetivamente fora.
      if (response.status === 204 || response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
    } catch {
      // Falha de rede: tratada abaixo como erro ao sair.
    }
    setErroAoSair(true);
    setSaindo(false);
  }

  const psicologo = perfil.tipo === "carregado" ? perfil.psicologo : null;

  return (
    <PsicologoContext.Provider value={psicologo}>
      <div className="flex min-h-full flex-1">
        {menuAberto && (
          <div
            aria-hidden="true"
            onClick={fecharMenu}
            className="fixed inset-0 z-40 bg-on-surface/40 backdrop-blur-xs lg:hidden"
          />
        )}

        <aside
          id="navegacao-principal"
          aria-label="Navegação principal"
          className={`fixed inset-y-0 left-0 z-50 flex w-65 max-w-[85vw] flex-col bg-primary text-on-primary shadow-[0_2px_12px_rgba(0,30,60,0.08)] transition-[transform,visibility] duration-200 ease-out lg:visible lg:translate-x-0 ${
            menuAberto ? "visible translate-x-0" : "invisible -translate-x-full"
          }`}
        >
          <div className="flex flex-1 flex-col overflow-y-auto px-4 py-5">
            <div className="mb-8 flex items-center justify-between gap-3 px-1.5">
              <div className="flex items-center gap-3">
                <MarcaPsicoTask />
                <span className="text-headline-sm font-bold tracking-tight">PsicoTask</span>
              </div>
              <button
                ref={botaoFecharRef}
                type="button"
                onClick={fecharMenu}
                aria-label="Fechar navegação"
                className="rounded-control p-1.5 text-primary-fixed transition-colors hover:bg-white/10 hover:text-on-primary lg:hidden"
              >
                <IconeFechar />
              </button>
            </div>

            <nav aria-labelledby="navegacao-titulo">
              <p
                id="navegacao-titulo"
                className="mb-2 px-2 text-label-sm uppercase text-primary-fixed-dim"
              >
                Menu principal
              </p>
              <ul className="flex flex-col gap-1">
                {NAVEGACAO.map((item) => (
                  <li key={item.rotulo}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        onClick={() => setMenuAberto(false)}
                        aria-current={item === itemAtivo ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-control px-3 py-2.5 text-label-lg transition-colors ${
                          item === itemAtivo
                            ? "bg-primary-container text-on-primary shadow-sm"
                            : "text-primary-fixed hover:bg-primary-container/60 hover:text-on-primary"
                        }`}
                      >
                        <span
                          className={item === itemAtivo ? "text-tertiary-fixed" : "opacity-80"}
                        >
                          {item.icone}
                        </span>
                        {item.rotulo}
                      </Link>
                    ) : (
                      <span
                        aria-disabled="true"
                        className="flex cursor-default items-center justify-between gap-3 rounded-control px-3 py-2.5 text-body-md text-primary-fixed/55"
                      >
                        <span className="flex items-center gap-3">
                          <span className="opacity-70">{item.icone}</span>
                          {item.rotulo}
                        </span>
                        <span className="rounded-pill bg-white/10 px-2 py-0.5 text-label-sm text-primary-fixed-dim/80">
                          Em breve
                        </span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="m-3 rounded-card border border-white/5 bg-primary-container/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5" aria-live="polite">
                {perfil.tipo === "carregando" && (
                  <>
                    <span className="size-9 shrink-0 animate-pulse rounded-pill bg-white/15" />
                    <span className="sr-only">Carregando perfil…</span>
                    <span aria-hidden="true" className="flex-1 space-y-1.5">
                      <span className="block h-3 w-28 animate-pulse rounded-pill bg-white/15" />
                      <span className="block h-2.5 w-20 animate-pulse rounded-pill bg-white/10" />
                    </span>
                  </>
                )}
                {psicologo && (
                  <>
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-tertiary-fixed text-label-md text-tertiary ring-2 ring-white/10"
                    >
                      {iniciais(psicologo.nome)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-label-md text-on-primary">
                        {psicologo.nome}
                      </span>
                      <span className="block truncate text-label-sm font-medium tracking-normal text-primary-fixed-dim">
                        {psicologo.registroProfissional}
                      </span>
                    </span>
                  </>
                )}
                {perfil.tipo === "erro" && (
                  <span className="text-body-sm text-primary-fixed">
                    Não foi possível carregar o perfil.
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={saindo}
                aria-busy={saindo}
                aria-label="Sair"
                title="Sair"
                className="shrink-0 rounded-control p-1.5 text-primary-fixed transition-colors hover:bg-white/10 hover:text-on-primary disabled:cursor-wait disabled:opacity-60"
              >
                <IconeSair />
              </button>
            </div>
            {erroAoSair && (
              <p role="alert" className="mt-2 text-body-sm text-error-container">
                Não foi possível sair. Tente novamente.
              </p>
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col lg:pl-65">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-outline-variant/30 bg-surface/90 px-4 shadow-[0_1px_6px_rgba(0,0,0,0.02)] backdrop-blur-xl sm:px-6">
            <button
              ref={botaoMenuRef}
              type="button"
              onClick={() => setMenuAberto(true)}
              aria-label="Abrir navegação"
              aria-controls="navegacao-principal"
              aria-expanded={menuAberto}
              className="-ml-1.5 rounded-control p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface lg:hidden"
            >
              <IconeMenu />
            </button>
            {itemAtivo && (
              <p className="truncate text-label-lg text-on-surface">{itemAtivo.titulo}</p>
            )}
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </PsicologoContext.Provider>
  );
}

function MarcaPsicoTask() {
  return (
    <span
      aria-hidden="true"
      className="flex size-9 items-center justify-center rounded-control bg-linear-to-tr from-primary-container to-primary-fixed-dim text-on-primary shadow-sm ring-1 ring-white/10"
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

function Icone({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      {children}
    </svg>
  );
}

function IconeResumo() {
  return (
    <Icone>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="4" rx="1.5" />
      <rect x="13" y="10" width="7" height="10" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
    </Icone>
  );
}

function IconeTarefas() {
  return (
    <Icone>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </Icone>
  );
}

function IconeCompromissos() {
  return (
    <Icone>
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M4 10h16M8.5 3v4M15.5 3v4" />
    </Icone>
  );
}

function IconeContextos() {
  return (
    <Icone>
      <path d="M4 7.5A2.5 2.5 0 016.5 5h3l2 2.5h6A2.5 2.5 0 0120 10v6.5a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 16.5z" />
    </Icone>
  );
}

function IconePerfil() {
  return (
    <Icone>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20a7 7 0 0114 0" />
    </Icone>
  );
}

function IconeSair() {
  return (
    <Icone>
      <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 16l-4-4 4-4M6 12h10" />
    </Icone>
  );
}

function IconeMenu() {
  return (
    <Icone>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icone>
  );
}

function IconeFechar() {
  return (
    <Icone>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icone>
  );
}

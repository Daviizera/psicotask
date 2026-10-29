import type { ReactNode } from "react";

// Ícones específicos de Tarefas. Os genéricos (editar, excluir, fechar, alerta,
// carregando, mais, contexto) vêm de src/components/contextos/icones.tsx.
function Icone({
  children,
  className = "size-4",
}: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export function IconeTarefas({ className }: Readonly<{ className?: string }>) {
  return (
    <Icone className={className ?? "size-5"}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </Icone>
  );
}

export function IconeCalendario() {
  return (
    <Icone className="size-3.5 shrink-0">
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M4 10h16M8.5 3v4M15.5 3v4" />
    </Icone>
  );
}

export function IconeAvancar() {
  return (
    <Icone className="size-3.5">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icone>
  );
}

export function IconeVoltar() {
  return (
    <Icone className="size-3.5">
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Icone>
  );
}

export function IconeConcluir() {
  return (
    <Icone className="size-3.5">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Icone>
  );
}

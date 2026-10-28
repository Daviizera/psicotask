import type { ReactNode } from "react";

function Icone({
  children,
  className = "size-5",
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

export function IconeContexto({ className }: Readonly<{ className?: string }>) {
  return (
    <Icone className={className}>
      <path d="M4 7.5A2.5 2.5 0 016.5 5h3l2 2.5h6A2.5 2.5 0 0120 10v6.5a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 16.5z" />
    </Icone>
  );
}

export function IconeMais() {
  return (
    <Icone className="size-4">
      <path d="M12 5v14M5 12h14" />
    </Icone>
  );
}

export function IconeEditar() {
  return (
    <Icone className="size-4">
      <path d="M4 20h4L18.5 9.5a2.12 2.12 0 00-3-3L5 17v3zM14 8l2 2" />
    </Icone>
  );
}

export function IconeExcluir() {
  return (
    <Icone className="size-4">
      <path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2" />
    </Icone>
  );
}

export function IconeFechar() {
  return (
    <Icone>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icone>
  );
}

export function IconeAlerta() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="mt-0.5 size-4 shrink-0">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7.5v5.5M12 16.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconeCarregando() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-4 animate-spin">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

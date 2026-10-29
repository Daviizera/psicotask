import type { ReactNode } from "react";

// Ícones específicos de Compromissos. Os genéricos (editar, excluir, fechar,
// alerta, carregando, mais) vêm de src/components/contextos/icones.tsx.
function Icone({
  children,
  className,
}: Readonly<{ children: ReactNode; className: string }>) {
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

export function IconeCalendario() {
  return (
    <Icone className="size-5">
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M4 10h16M8.5 3v4M15.5 3v4" />
    </Icone>
  );
}

export function IconeRelogio() {
  return (
    <Icone className="size-3.5 shrink-0">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icone>
  );
}

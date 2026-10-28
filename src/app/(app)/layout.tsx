import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { readSessionPsychologistId } from "@/lib/auth/request-session";

// Barreira inicial da área autenticada: valida o JWT do cookie no servidor.
// A existência do perfil é confirmada pelo shell via /api/auth/me, e cada API
// continua aplicando sua própria autenticação.
export default async function AreaAutenticadaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const psicologoId = await readSessionPsychologistId();
  if (psicologoId === null) redirect("/login");

  return <AppShell>{children}</AppShell>;
}

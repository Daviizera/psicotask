"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { iniciais, useAtualizarPsicologo } from "@/components/app-shell";
import { IconeAlerta } from "@/components/contextos/icones";
import { ehPerfil } from "@/components/perfil/perfil";
import { PerfilForm } from "@/components/perfil/perfil-form";
import type { Psychologist } from "@/modules/psicologos/types/psychologist.types";

type EstadoDoPerfil =
  | { tipo: "carregando" }
  | { tipo: "sucesso"; perfil: Psychologist }
  | { tipo: "erro"; mensagem: string };

const MENSAGENS_DO_PERFIL = {
  servidor: "Não foi possível carregar seu perfil. Tente novamente em instantes.",
  rede: "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
} as const;

export default function PerfilPage() {
  const router = useRouter();
  const atualizarPsicologoNoShell = useAtualizarPsicologo();
  const [estado, setEstado] = useState<EstadoDoPerfil>({ tipo: "carregando" });
  const [tentativa, setTentativa] = useState(0);

  // A tela usa GET /api/perfil como autoridade, independentemente do shell.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/perfil", { credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) {
          setEstado({ tipo: "erro", mensagem: MENSAGENS_DO_PERFIL.servidor });
          return;
        }
        const corpo: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        setEstado(
          ehPerfil(corpo)
            ? { tipo: "sucesso", perfil: corpo }
            : { tipo: "erro", mensagem: MENSAGENS_DO_PERFIL.servidor },
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setEstado({ tipo: "erro", mensagem: MENSAGENS_DO_PERFIL.rede });
        }
      });
    return () => controller.abort();
  }, [router, tentativa]);

  function tentarNovamente() {
    setEstado({ tipo: "carregando" });
    setTentativa((valor) => valor + 1);
  }

  function handleSalvo(perfil: Psychologist) {
    setEstado({ tipo: "sucesso", perfil });
    // Nome, iniciais e registro da sidebar passam a refletir a resposta do PUT.
    atualizarPsicologoNoShell(perfil);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-1">
        <h1 className="text-headline-lg-mobile text-on-surface sm:text-headline-lg">Perfil</h1>
        <p className="text-body-md text-on-surface-variant">
          Seus dados profissionais exibidos no PsicoTask.
        </p>
      </header>

      {estado.tipo === "carregando" && <PerfilCarregando />}

      {estado.tipo === "erro" && (
        <div
          role="alert"
          className="flex flex-col gap-4 rounded-card border border-error/30 bg-error-container p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="flex items-start gap-2.5 text-body-md text-error">
            <IconeAlerta />
            <span>{estado.mensagem}</span>
          </p>
          <button
            type="button"
            onClick={tentarNovamente}
            className="shrink-0 rounded-control border border-error/30 bg-surface-container-lowest px-4 py-2 text-label-lg text-error transition-colors hover:bg-surface-container-low"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {estado.tipo === "sucesso" && (
        <section
          aria-labelledby="perfil-identificacao"
          className="overflow-hidden rounded-card border border-outline-variant/40 bg-surface-container-lowest shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]"
        >
          <div className="flex items-center gap-4 border-b border-outline-variant/30 bg-surface-container-low/50 px-5 py-5 sm:px-6">
            <span
              aria-hidden="true"
              className="flex size-14 shrink-0 items-center justify-center rounded-pill bg-tertiary-fixed text-headline-sm text-tertiary ring-4 ring-tertiary-fixed/30"
            >
              {iniciais(estado.perfil.nome)}
            </span>
            <div className="min-w-0 space-y-0.5">
              <h2
                id="perfil-identificacao"
                className="break-words text-headline-sm text-on-surface"
              >
                {estado.perfil.nome}
              </h2>
              <p className="break-words text-body-md text-on-surface-variant">
                <span className="sr-only">Registro profissional: </span>
                {estado.perfil.registroProfissional}
                <span aria-hidden="true"> · </span>
                <span className="sr-only">, e-mail: </span>
                {estado.perfil.email}
              </p>
            </div>
          </div>

          <div className="space-y-1 px-5 pt-5 sm:px-6">
            <h3 className="text-label-lg text-on-surface">Dados profissionais</h3>
            <p className="text-body-sm text-on-surface-variant">
              Altere os campos desejados e salve. Somente os dados modificados são enviados.
            </p>
          </div>
          <div className="px-5 py-5 sm:px-6">
            <PerfilForm
              key={estado.perfil.id}
              perfil={estado.perfil}
              onSalvo={handleSalvo}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function PerfilCarregando() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Carregando perfil…
      </p>
      <div
        aria-hidden="true"
        className="overflow-hidden rounded-card border border-outline-variant/40 bg-surface-container-lowest"
      >
        <span className="flex items-center gap-4 border-b border-outline-variant/30 px-5 py-5 sm:px-6">
          <span className="size-14 shrink-0 animate-pulse rounded-pill bg-surface-container" />
          <span className="flex-1 space-y-2">
            <span className="block h-4 w-48 animate-pulse rounded-pill bg-surface-container" />
            <span className="block h-3 w-64 animate-pulse rounded-pill bg-surface-container-low" />
          </span>
        </span>
        <span className="block space-y-5 px-5 py-6 sm:px-6">
          {[0, 1, 2].map((campo) => (
            <span key={campo} className="block space-y-2">
              <span className="block h-3.5 w-32 animate-pulse rounded-pill bg-surface-container" />
              <span className="block h-11 w-full animate-pulse rounded-control bg-surface-container-low" />
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

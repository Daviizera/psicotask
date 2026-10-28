# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

PsicoTask: a Next.js 16 (App Router) + Prisma 7 + PostgreSQL app for psychologists to manage contexts, tasks and appointments. The backend (Route Handlers under `src/app/api/`) is done; the frontend is being built in the same app (`src/app/page.tsx` is still the create-next-app placeholder). Code, comments, API messages and domain names are in Portuguese (`tarefas`, `contextos`, `compromissos`, `resumo`, `psicologos`, `perfil`); keep that convention.

`docs/frontend-handoff.md` is the authoritative API contract (request/response shapes, status codes, error messages, auth flow). `prisma/README.md` documents DB, seed and migration details. Read them before changing endpoints or schema.

## Commands

Development is on Windows/PowerShell; docs use `npm.cmd` / `npx.cmd`.

```powershell
npm.cmd run dev                     # Next dev server
npx.cmd tsc --noEmit                # type check
npx.cmd eslint .                    # lint
npx.cmd prisma validate
npx.cmd prisma migrate dev          # apply migrations (needs shadow DB permissions)
npx.cmd prisma generate             # REQUIRED after clone/schema change; output src/generated/prisma is gitignored
npm.cmd run prisma:seed             # creates the fictitious dev psychologist (add `-- --reset-password` to reset its hash)
node --test tests/*.test.mjs        # unit tests (Node built-in runner, no DB needed)
node --test tests/task.test.mjs     # single test file
```

HTTP integration suites (`tests/auth.http.test.mjs`, `tests/ownership.http.test.mjs`) are skipped unless `AUTH_HTTP_BASE_URL` is set. They hit a running dev server and real PostgreSQL, must run sequentially, and expect the seeded dev profile with zero contexts/tasks/appointments:

```powershell
npm.cmd run dev -- --hostname 127.0.0.1 --port 3112   # terminal 1
$env:AUTH_HTTP_BASE_URL = "http://127.0.0.1:3112"     # terminal 2
node --test --test-concurrency=1 tests/auth.http.test.mjs tests/ownership.http.test.mjs
```

Env vars (see `.env.example`): `DATABASE_URL` (dev DB `psicotask_dev_v2`, schema `public` — the seed refuses other targets), `AUTH_SECRET` (≥32 bytes), `DEV_PSYCHOLOGIST_PASSWORD`.

## Architecture

Request flow: **Route Handler → Zod schema → Service → Repository interface → Prisma repository → PostgreSQL.**

- `src/modules/<domain>/` holds `types/`, `schemas/` (Zod), `services/`, `repositories/` (interface + `prisma-*` + `in-memory-*` impls), `errors/`, and a `*.container.ts` that wires the Prisma repository into the service singleton. Route handlers import only from the container. `resumo` has no repository; it aggregates the other services.
- In-memory repositories exist only for tests; containers always use Prisma.
- `src/lib/prisma.ts`: single PrismaClient (`@prisma/adapter-pg`) cached on `globalThis.psicoPrisma`; client is imported from `@/generated/prisma/client`. Server-only — never import Prisma in client components.

### Auth and ownership

- Login (`/api/auth/login`) issues an HS256 JWT (`jose`) in the HttpOnly cookie `psicotask_session`; passwords are hashed with scrypt (`src/lib/auth/password.ts`). No signup/refresh endpoints.
- Every domain route handler is wrapped in `withAuthentication` (`src/lib/auth/with-authentication.ts`), which authenticates before any body/ID validation, rejects cross-origin mutating requests (403), and sets `Cache-Control: no-store`. Handlers declare `export const runtime = "nodejs"` and must re-throw `AuthenticationError` from their own catch blocks.
- Ownership is enforced in the **Prisma repositories**, not in routes or services: each repository method calls `getCurrentPsychologistId()` (`src/lib/current-psychologist.ts`, reads the session cookie via `next/headers` and confirms the psychologist still exists) and scopes every query by `psicologoId`. Clients never send an owner ID. A composite FK in the DB prevents linking a task to another psychologist's context.
- Prisma known errors (e.g. `P2002`) are translated into domain errors in repositories; responses never leak Prisma details. Validation errors use `{ error: "Dados inválidos", details: [{ path, message }] }`.

### Tests

Tests are plain `.mjs` files using `node:test` and load TypeScript sources through `jiti`. Unit tests set a dummy `DATABASE_URL`, stub `globalThis.psicoPrisma` with a fake client, and set the session identity via `globalThis.psicoTestSessionPsychologistId` (see `tests/helpers/`), so they never touch a real DB or Next request context.

## Current Frontend Direction

- Backend, banco de dados, autenticação e contratos de API são a base estável do PsicoTask.
- Uma versão anterior do frontend chegou a ser integrada e validada tecnicamente, mas não será a identidade visual definitiva.
- Uma nova etapa de frontend está sendo iniciada na branch `frontend-davi`.
- A nova homepage definida pelo desenvolvedor é a referência visual principal para as demais telas.
- As telas são implementadas progressivamente e validadas antes de qualquer integração definitiva à `main`.
- O Figma pode ser usado como artefato de UX e documentação visual, mas a implementação deve respeitar os requisitos e contratos reais da aplicação.

## Frontend Development Guardrails

Regras obrigatórias para a etapa atual de frontend.

### Contexto e branches

- O PsicoTask é desenvolvido individualmente por Davi, responsável pelo backend existente e pelo novo frontend.
- Desenvolver o novo frontend exclusivamente na branch `frontend-davi`. A `main` deve permanecer estável.
- Não realizar commits, push, merge, rebase, troca de branch ou alterações na `main` sem solicitação explícita do desenvolvedor.
- Não usar a antiga implementação de frontend nem a branch de integração anterior como referência visual, salvo solicitação explícita.

### Backend é a base estável

O objetivo é construir uma nova interface mantendo o backend (já implementado, testado e funcional) intacto. O frontend se adapta aos contratos da API, nunca o contrário.

- Não modificar arquivos de backend sem autorização explícita do desenvolvedor.
- Não modificar Route Handlers, Services, Repositories, containers, schemas Zod ou regras de domínio para adaptar uma interface.
- Não alterar os contratos documentados em `docs/frontend-handoff.md` (fonte autoritativa, ver "Project") nem criar novos endpoints sem autorização explícita.
- Não alterar `schema.prisma`, migrations, seed, configuração do Prisma ou estrutura do PostgreSQL sem autorização explícita.
- Não executar `prisma migrate`, `prisma db push`, reset de banco ou qualquer operação destrutiva sem autorização explícita.
- Não alterar o mecanismo de autenticação: JWT, cookie `psicotask_session`, hashing de senha, controle de sessão, `withAuthentication` e regras de ownership permanecem como estão, salvo autorização explícita.
- Nunca armazenar JWT ou credenciais de sessão em `localStorage`.
- Não instalar, remover ou atualizar dependências sem autorização explícita.
- Se uma solicitação de frontend parecer exigir mudança no backend, parar e explicar a necessidade antes de modificar qualquer arquivo do backend.
- Na dúvida entre alterar a interface ou modificar a API, preservar a API e solicitar orientação.

### Implementação de telas

- Trabalhar em uma tela ou etapa claramente delimitada por vez.
- Antes de implementar uma tela, analisar os arquivos existentes relevantes, os requisitos funcionais correspondentes e a referência visual fornecida pelo desenvolvedor.
- Usar a nova homepage fornecida pelo desenvolvedor como principal referência visual e preservar de forma consistente identidade visual, paleta, tipografia, espaçamento, bordas, componentes, estados de interação e padrões de layout.
- Não copiar automaticamente estruturas visuais do frontend anterior.
- Reutilizar componentes quando isso melhorar consistência e manutenção sem adicionar complexidade desnecessária.
- Usar TypeScript corretamente; evitar `any` sem justificativa técnica.
- Manter as interfaces responsivas.
- Preservar a convenção de nomes de domínio em português.
- Não introduzir informações clínicas, prontuários, pacientes, registros de sessão ou funcionalidades fora do escopo documentado do PsicoTask.

### Conclusão de tarefas

- Antes de concluir, verificar se a alteração respeita os contratos existentes do backend.
- Informar exatamente quais arquivos foram criados, modificados ou removidos.
- Informar quais validações foram executadas e seus resultados.
- Não declarar uma tarefa concluída se houver erros conhecidos de TypeScript, lint ou funcionamento relacionados à alteração.

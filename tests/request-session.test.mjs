import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import { after, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { SignJWT } from "jose";

const previousEnvironment = Object.fromEntries(["AUTH_SECRET", "DATABASE_URL", "NODE_ENV"].map(key => [key, process.env[key]]));
const previousPrisma = globalThis.psicoPrisma;
const previousCookies = globalThis.psicoCookieTestContext;
const context = new AsyncLocalStorage();
globalThis.psicoCookieTestContext = context;
const secret = randomBytes(48).toString("hex");
process.env.AUTH_SECRET = secret;
process.env.DATABASE_URL = "postgresql://unused.invalid/session_tests";
process.env.NODE_ENV = "test";
let profiles;
let queries;
let databaseFailure;
globalThis.psicoPrisma = {
  psicologo: {
    async findUnique({ where, select }) {
      queries.push(where.id);
      assert.deepEqual(select, { id: true });
      if (databaseFailure) throw new Error("DETALHE_INTERNO_NAO_EXPOR");
      await new Promise(resolve => setTimeout(resolve, where.id === 11 ? 5 : 1));
      return profiles.has(where.id) ? { id: where.id } : null;
    },
  },
};
const jiti = createJiti(import.meta.url, {
  tsconfigPaths: true, fsCache: false,
  alias: { "next/headers": fileURLToPath(new URL("./helpers/cookies.mjs", import.meta.url)) },
});
const { createSessionToken, SESSION_COOKIE_NAME } = await jiti.import("../src/lib/auth/session.ts");
const { readSessionPsychologistId } = await jiti.import("../src/lib/auth/request-session.ts");
const { getCurrentPsychologistId } = await jiti.import("../src/lib/current-psychologist.ts");
const { withAuthentication } = await jiti.import("../src/lib/auth/with-authentication.ts");
const tokenA = await createSessionToken(11);
const tokenB = await createSessionToken(22);
const run = (token, callback) => context.run(token ? { [SESSION_COOKIE_NAME]: token } : {}, callback);

beforeEach(() => {
  profiles = new Set([11, 22]); queries = []; databaseFailure = false;
  process.env.AUTH_SECRET = secret;
});
after(() => {
  for (const [key, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  if (previousPrisma === undefined) delete globalThis.psicoPrisma; else globalThis.psicoPrisma = previousPrisma;
  if (previousCookies === undefined) delete globalThis.psicoCookieTestContext; else globalThis.psicoCookieTestContext = previousCookies;
});

test("leitura do cookie valida JWT e resolve cada usuário sem regra de perfil único", async () => {
  assert.equal(await run(tokenA, readSessionPsychologistId), 11);
  assert.equal(await run(tokenB, getCurrentPsychologistId), 22);
  assert.equal(await run(tokenA, getCurrentPsychologistId), 11);
  assert.deepEqual(queries, [22, 11]);
});

test("requisições simultâneas preservam identidades independentes", async () => {
  const results = await Promise.all(Array.from({ length: 20 }, (_, index) => run(
    index % 2 ? tokenB : tokenA,
    async () => [await getCurrentPsychologistId(), await getCurrentPsychologistId()],
  )));
  results.forEach((ids, index) => assert.deepEqual(ids, index % 2 ? [22, 22] : [11, 11]));
});

test("sessões ausentes, inválidas e expiradas falham antes de consultar o banco", async () => {
  const now = Math.floor(Date.now() / 1000);
  const expired = await new SignJWT({ psicologoId: 11 }).setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now - 120).setExpirationTime(now - 60).sign(new TextEncoder().encode(secret));
  for (const token of [undefined, "invalido", expired]) {
    await assert.rejects(run(token, getCurrentPsychologistId), { code: "AUTHENTICATION_REQUIRED" });
  }
  assert.equal(queries.length, 0);
});

test("usuário removido não pode usar JWT ainda válido", async () => {
  profiles.delete(11);
  await assert.rejects(run(tokenA, getCurrentPsychologistId), { code: "AUTHENTICATION_REQUIRED" });
});

test("guard retorna 401 antes do handler e não aceita identidade em body/query", async () => {
  let executed = false;
  const guarded = withAuthentication(async () => { executed = true; return Response.json({}); });
  const request = new Request("http://localhost/api/tarefas?psicologoId=11", {
    method: "POST", body: JSON.stringify({ psicologoId: 11 }),
  });
  const response = await run(undefined, () => guarded(request));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: "Não autenticado" });
  assert.equal(executed, false);
  assert.equal(queries.length, 0);
});

test("guard mantém argumentos da rota e aplica no-store a respostas do handler", async () => {
  const guarded = withAuthentication(async (_request, { params }) => Response.json({
    id: (await params).id, owner: await getCurrentPsychologistId(),
  }));
  const response = await run(tokenB, () => guarded(new Request("http://localhost/api/contextos/3"), { params: Promise.resolve({ id: "3" }) }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { id: "3", owner: 22 });
});

test("guard mantém CSRF por origem nas mutações autenticadas", async () => {
  let executed = false;
  const guarded = withAuthentication(async () => { executed = true; return Response.json({}); });
  const response = await run(tokenA, () => guarded(new Request("http://localhost/api/perfil", {
    method: "PUT", headers: { origin: "https://outro.example" }, body: "{}",
  })));
  assert.equal(response.status, 403);
  assert.equal(executed, false);
});

test("guard traduz falha de autenticação tardia e oculta erros de infraestrutura", async () => {
  const request = new Request("http://localhost/api/perfil");
  const guarded = withAuthentication(async () => {
    profiles.delete(11);
    await getCurrentPsychologistId();
    return Response.json({});
  });
  assert.equal((await run(tokenA, () => guarded(request))).status, 401);
  databaseFailure = true;
  const response = await run(tokenA, () => guarded(request));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Erro interno do servidor" });
});

test("guard não transforma AUTH_SECRET ausente em sessão válida", async () => {
  delete process.env.AUTH_SECRET;
  const guarded = withAuthentication(async () => Response.json({}));
  const response = await run(tokenA, () => guarded(new Request("http://localhost/api/perfil")));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Erro interno do servidor" });
});

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, beforeEach, test } from "node:test";
import { createJiti } from "jiti";
import { SignJWT, decodeJwt, decodeProtectedHeader } from "jose";
import { NextRequest } from "next/server.js";

// Testes isolados: sem .env, PostgreSQL ou credenciais reais.
const previousEnvironment = Object.fromEntries(
  ["DATABASE_URL", "NODE_ENV", "AUTH_SECRET"].map((key) => [key, process.env[key]]),
);
const previousPrisma = globalThis.psicoPrisma;
const secret = randomBytes(48).toString("hex");
const password = " senha ficticia exclusiva dos testes ";
const publicSelect = { id: true, nome: true, email: true, registroProfissional: true };
const credentialsSelect = { id: true, senhaHash: true };
const profile = {
  id: 73,
  nome: "Perfil de teste",
  email: "auth@tests.example",
  registroProfissional: "AUTH-73",
};
let state;
let calls;

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://unused.invalid/auth_isolated_tests";
process.env.AUTH_SECRET = secret;
globalThis.psicoPrisma = {
  psicologo: {
    async findUnique(options) {
      calls.push(options);
      if (state.failure) throw state.failure;
      const field = Object.keys(options.where)[0];
      assert.ok(["id", "email"].includes(field));
      assert.deepEqual(Object.keys(options.where), [field]);
      assert.deepEqual(options.select, field === "email" ? credentialsSelect : publicSelect);
      const record = state.records.find((record) => record[field] === options.where[field]);
      return record
        ? Object.fromEntries(Object.keys(options.select).map((key) => [key, record[key]]))
        : null;
    },
    async findMany() {
      assert.fail("A autenticacao nao deve usar o resolvedor de desenvolvimento de um unico perfil.");
    },
  },
};

const jiti = createJiti(import.meta.url, { tsconfigPaths: true, fsCache: false });
const { hashPassword, verifyPassword } = await jiti.import("../src/lib/auth/password.ts");
const {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  createSessionToken,
  verifySessionToken,
  sessionCookieOptions,
} = await jiti.import("../src/lib/auth/session.ts");
const { loginSchema } = await jiti.import("../src/modules/auth/schemas/login.schema.ts");
const { isSameOriginRequest } = await jiti.import("../src/lib/auth/origin.ts");
const { PrismaAuthRepository } = await jiti.import(
  "../src/modules/auth/repositories/prisma-auth.repository.ts",
);
const { AuthService } = await jiti.import("../src/modules/auth/services/auth.service.ts");
const { POST: login } = await jiti.import("../src/app/api/auth/login/route.ts");
const { GET: me } = await jiti.import("../src/app/api/auth/me/route.ts");
const { POST: logout } = await jiti.import("../src/app/api/auth/logout/route.ts");
const storedHash = await hashPassword(password);

beforeEach(() => {
  process.env.NODE_ENV = "test";
  process.env.AUTH_SECRET = secret;
  calls = [];
  state = { records: [{ ...profile, senhaHash: storedHash }], failure: undefined };
});

after(() => {
  for (const [key, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  if (previousPrisma === undefined) delete globalThis.psicoPrisma;
  else globalThis.psicoPrisma = previousPrisma;
});

function loginRequest(payload = { email: profile.email, senha: password }, options = {}) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", ...options.headers },
    body: options.rawBody ?? JSON.stringify(payload),
  });
}

function meRequest(token) {
  return new NextRequest("http://localhost/api/auth/me", {
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  });
}

function logoutRequest(origin) {
  return new Request("http://localhost/api/auth/logout", {
    method: "POST",
    headers: origin ? { origin } : {},
  });
}

async function assertPublicResponse(response, expectedStatus, expectedBody) {
  assert.equal(response.status, expectedStatus);
  assert.match(response.headers.get("cache-control"), /no-store/);
  const text = await response.text();
  for (const forbidden of [password, storedHash, secret, "DETALHE_INTERNO_NAO_EXPOR"]) {
    assert.equal(text.includes(forbidden), false, "A resposta nao pode expor material privado.");
  }
  if (expectedBody !== undefined) assert.deepEqual(JSON.parse(text), expectedBody);
  return text ? JSON.parse(text) : null;
}

async function signedToken(claims, algorithm = "HS256", signingSecret = secret) {
  return new SignJWT(claims).setProtectedHeader({ alg: algorithm, typ: "JWT" })
    .sign(new TextEncoder().encode(signingSecret));
}

test("schema exige email e senha, rejeita campos extras e preserva espacos da senha", () => {
  assert.equal(loginSchema.parse({ email: profile.email, senha: password }).senha, password);
  for (const payload of [
    {}, null, [], { email: profile.email }, { senha: password },
    { email: "invalido", senha: password }, { email: profile.email, senha: "" },
    { email: profile.email, senha: 123 }, { email: profile.email, senha: "a".repeat(1025) },
    { email: `${"x".repeat(250)}@tests.example`, senha: password },
    ...["id", "psicologoId", "psicologo_fk", "senhaHash", "senha_hash"].map((field) => ({
      email: profile.email, senha: password, [field]: 73,
    })),
  ]) assert.equal(loginSchema.safeParse(payload).success, false);
});

test("hash preserva o formato scrypt existente e verifica senha sem normalizacao", async () => {
  assert.match(storedHash, /^scrypt\$131072\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  assert.equal(await verifyPassword(password, storedHash), true);
  assert.equal(await verifyPassword(password.trim(), storedHash), false);
});

test("hash ausente, corrompido ou com parametros diferentes falha sem excecao", async () => {
  for (const hash of [null, "corrompido", storedHash.replace("131072", "1048576")]) {
    assert.equal(await verifyPassword(password, hash), false);
  }
});

test("JWT usa somente identidade e tempos, HS256 e duracao de oito horas", async () => {
  const token = await createSessionToken(profile.id);
  assert.equal(decodeProtectedHeader(token).alg, "HS256");
  const payload = decodeJwt(token);
  assert.deepEqual(Object.keys(payload).sort(), ["exp", "iat", "psicologoId"]);
  assert.equal(payload.psicologoId, profile.id);
  assert.equal(payload.exp - payload.iat, 8 * 60 * 60);
  assert.equal(SESSION_DURATION_SECONDS, 28800);
  assert.equal(await verifySessionToken(token), profile.id);
});

test("JWT rejeita assinatura adulterada, algoritmo diferente e expiracao", async () => {
  const now = Math.floor(Date.now() / 1000);
  const claims = { psicologoId: profile.id, iat: now, exp: now + 60 };
  assert.equal(await verifySessionToken(await signedToken(claims)), profile.id);
  const tokens = [
    "token-invalido",
    await signedToken(claims, "HS256", `${secret}outro`),
    await signedToken(claims, "HS384"),
    await signedToken({ ...claims, iat: now - 120, exp: now - 60 }),
  ];
  for (const token of tokens) assert.equal(await verifySessionToken(token), null);
  assert.equal(await verifySessionToken(undefined), null);
});

test("JWT exige identidade INTEGER positiva e claims iat/exp", async () => {
  const now = Math.floor(Date.now() / 1000);
  const base = { psicologoId: profile.id, iat: now, exp: now + 60 };
  const invalid = [
    ...["73", 0, -1, 1.5, 2147483648].map((psicologoId) => ({ ...base, psicologoId })),
    { psicologoId: profile.id, exp: now + 60 },
    { psicologoId: profile.id, iat: now },
    { ...base, iat: now + 60, exp: now + 120 },
    { ...base, exp: now + SESSION_DURATION_SECONDS + 1 },
    { ...base, iat: now - 0.5 },
  ];
  for (const claims of invalid) assert.equal(await verifySessionToken(await signedToken(claims)), null);
});

test("segredo ausente, curto ou placeholder impede emissao e verificacao", async () => {
  const token = await createSessionToken(profile.id);
  for (const value of [undefined, "", "curto", "defina-um-segredo-local-forte"]) {
    if (value === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = value;
    await assert.rejects(createSessionToken(profile.id), /AUTH_SECRET/);
    await assert.rejects(verifySessionToken(token), /AUTH_SECRET/);
  }
});

test("cookie tem atributos esperados e Secure somente em producao", () => {
  assert.equal(SESSION_COOKIE_NAME, "psicotask_session");
  for (const environment of ["test", "development", "production"]) {
    process.env.NODE_ENV = environment;
    const options = sessionCookieOptions();
    assert.equal(options.httpOnly, true);
    assert.equal(options.sameSite, "lax");
    assert.equal(options.path, "/");
    assert.equal(options.secure, environment === "production");
  }
});

test("repository seleciona credenciais por email UNIQUE e perfil por ID sem hash", async () => {
  const repository = new PrismaAuthRepository();
  assert.deepEqual(await repository.findCredentialsByEmail(profile.email), { id: profile.id, senhaHash: storedHash });
  assert.deepEqual(await repository.findPublicById(profile.id), profile);
  assert.equal(await repository.findCredentialsByEmail("ausente@tests.example"), null);
  assert.equal(await repository.findPublicById(999), null);
});

test("service recebe interface de repository e nao depende de um unico psicologo", async () => {
  const service = new AuthService({
    async findCredentialsByEmail(email) {
      assert.equal(email, profile.email);
      return { id: profile.id, senhaHash: storedHash };
    },
    async findPublicById(id) {
      assert.equal(id, profile.id);
      return profile;
    },
  });
  assert.deepEqual(await service.authenticate({ email: profile.email, senha: password }), profile);
  assert.deepEqual(await service.findCurrent(profile.id), profile);
});

test("login correto cria cookie, retorna perfil publico e me autentica esse ID", async () => {
  state.records.push({ ...profile, id: 91, email: "outro@tests.example" });
  const response = await login(loginRequest());
  const cookie = response.cookies.get(SESSION_COOKIE_NAME);
  assert.ok(cookie?.value);
  assert.equal(cookie.maxAge, SESSION_DURATION_SECONDS);
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.sameSite, "lax");
  assert.equal(cookie.path, "/");
  assert.ok(!cookie.secure);
  await assertPublicResponse(response, 200, profile);
  await assertPublicResponse(await me(meRequest(cookie.value)), 200, profile);
});

test("email inexistente e senha incorreta retornam a mesma resposta 401", async () => {
  const missing = await login(loginRequest({ email: "ausente@tests.example", senha: password }));
  const wrong = await login(loginRequest({ email: profile.email, senha: "senha incorreta" }));
  assert.equal(missing.headers.has("set-cookie"), false);
  assert.equal(wrong.headers.has("set-cookie"), false);
  const missingBody = await assertPublicResponse(missing, 401);
  const wrongBody = await assertPublicResponse(wrong, 401);
  assert.deepEqual(missingBody, wrongBody);
  assert.deepEqual(Object.keys(wrongBody), ["error"]);
});

test("login rejeita JSON malformado, campos protegidos e payload invalido antes do banco", async () => {
  for (const payload of [
    {}, null, [], { email: "invalido", senha: password },
    { email: profile.email, senha: "" },
    ...["id", "psicologoId", "psicologo_fk", "senhaHash"].map((field) => ({
      email: profile.email, senha: password, [field]: 73,
    })),
  ]) {
    const body = await assertPublicResponse(await login(loginRequest(payload)), 400);
    assert.equal(body.error, "Dados inválidos");
    assert.ok(Array.isArray(body.details));
  }
  await assertPublicResponse(await login(loginRequest(undefined, { rawBody: "{" })), 400);
  await assertPublicResponse(await login(loginRequest(undefined, { headers: { "content-type": "text/plain" } })), 400);
  assert.equal(calls.length, 0);
});

test("login e logout rejeitam Origin externo antes de consultar credenciais", async () => {
  await assertPublicResponse(await login(loginRequest(undefined, { headers: { origin: "https://outro.example" } })), 403);
  await assertPublicResponse(await logout(logoutRequest("https://outro.example")), 403);
  assert.equal(calls.length, 0);
});

test("origem usa Host recebido quando Next normaliza loopback, sem confiar em forwarded host", async () => {
  for (const host of ["127.0.0.1:3112", "localhost:3112", "[::1]:3112"]) {
    const request = new Request("http://localhost:3112/api/auth/logout", {
      method: "POST", headers: { host, origin: `http://${host}` },
    });
    assert.equal(isSameOriginRequest(request), true);
    await assertPublicResponse(await logout(request), 204);
  }
  for (const origin of ["http://localhost:3112", "http://127.0.0.1:9999", "https://127.0.0.1:3112", "https://outro.example", "null", ""]) {
    const request = new Request("http://localhost:3112/api/auth/logout", {
      method: "POST",
      headers: { host: "127.0.0.1:3112", origin, "x-forwarded-host": "outro.example" },
    });
    assert.equal(isSameOriginRequest(request), false);
    await assertPublicResponse(await logout(request), 403);
  }
  const request = new Request("http://localhost:3112/api/auth/login", {
    method: "POST", headers: { host: "127.0.0.1:3112", origin: "http://127.0.0.1:3112", "content-type": "application/json" },
    body: "{}",
  });
  await assertPublicResponse(await login(request), 400);
  assert.equal(calls.length, 0);
});

test("me sem sessao, com token invalido ou expirado retorna 401 sem consultar banco", async () => {
  const now = Math.floor(Date.now() / 1000);
  for (const token of [
    undefined, "token-invalido",
    await signedToken({ psicologoId: profile.id, iat: now - 120, exp: now - 60 }),
  ]) await assertPublicResponse(await me(meRequest(token)), 401);
  assert.equal(calls.length, 0);
});

test("me busca perfil persistido a cada acesso e trata psicologo removido como 401", async () => {
  const token = await createSessionToken(profile.id);
  state.records[0].nome = "Nome atualizado no banco";
  await assertPublicResponse(await me(meRequest(token)), 200, { ...profile, nome: "Nome atualizado no banco" });
  state.records = [];
  await assertPublicResponse(await me(meRequest(token)), 401);
});

test("logout remove o cookie e me sem esse cookie volta a 401", async () => {
  const token = await createSessionToken(profile.id);
  await assertPublicResponse(await me(meRequest(token)), 200, profile);
  const response = await logout(logoutRequest("http://localhost"));
  const cookie = response.cookies.get(SESSION_COOKIE_NAME);
  assert.equal(cookie.value, "");
  assert.equal(cookie.path, "/");
  assert.ok(cookie.maxAge === 0 || cookie.expires?.getTime() <= Date.now());
  await assertPublicResponse(response, 204);
  await assertPublicResponse(await me(meRequest()), 401);
  // Sem revogacao centralizada: o logout remove apenas o cookie deste navegador.
  assert.equal(await verifySessionToken(token), profile.id);
});

test("AUTH_SECRET ausente retorna 500 generico no login e em sessao recebida", async () => {
  const token = await createSessionToken(profile.id);
  delete process.env.AUTH_SECRET;
  const loginResponse = await login(loginRequest());
  assert.equal(loginResponse.headers.has("set-cookie"), false);
  await assertPublicResponse(loginResponse, 500, { error: "Erro interno do servidor" });
  await assertPublicResponse(await me(meRequest(token)), 500, { error: "Erro interno do servidor" });
});

test("falhas inesperadas de banco retornam 500 sem mensagem interna", async () => {
  const token = await createSessionToken(profile.id);
  state.failure = new Error("DETALHE_INTERNO_NAO_EXPOR");
  await assertPublicResponse(await login(loginRequest()), 500, { error: "Erro interno do servidor" });
  await assertPublicResponse(await me(meRequest(token)), 500, { error: "Erro interno do servidor" });
});

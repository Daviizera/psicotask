import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { config } from "dotenv";
import { createJiti } from "jiti";
import { SignJWT, decodeJwt, decodeProtectedHeader } from "jose";

// Opt-in: iniciar Next e executar com AUTH_HTTP_BASE_URL=http://127.0.0.1:3112.
// Usa as credenciais locais; não redefine senha, cria dados ou imprime segredos.
const baseUrl = process.env.AUTH_HTTP_BASE_URL;

test("Auth por HTTP real com PostgreSQL de desenvolvimento", { skip: !baseUrl }, async (t) => {
  const base = new URL(baseUrl);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(base.hostname), "Usar servidor local de desenvolvimento.");
  config({ quiet: true });
  const secret = process.env.AUTH_SECRET;
  const password = process.env.DEV_PSYCHOLOGIST_PASSWORD;
  assert.ok(secret && Buffer.byteLength(secret) >= 32, "Configure AUTH_SECRET localmente.");
  assert.ok(password?.trim(), "Configure DEV_PSYCHOLOGIST_PASSWORD localmente.");

  const jiti = createJiti(import.meta.url, { tsconfigPaths: true, fsCache: false });
  const { prisma } = await jiti.import("../src/lib/prisma.ts");
  try {
    const [target] = await prisma.$queryRaw`SELECT current_database() AS database`;
    assert.ok(target.database === "psicotask_dev_v2", "Usar somente o banco de desenvolvimento.");
    const counts = async () => ({
      psicologo: await prisma.psicologo.count(), contexto: await prisma.contexto.count(),
      tarefa: await prisma.tarefa.count(), compromisso: await prisma.compromisso.count(),
    });
    const initialCounts = await counts();
    assert.deepEqual(initialCounts, { psicologo: 1, contexto: 0, tarefa: 0, compromisso: 0 });
    const [stored] = await prisma.psicologo.findMany({ take: 2 });
    const { id, nome, email, registroProfissional } = stored;
    const publicProfile = { id, nome, email, registroProfissional };
    const forbidden = [secret, password, stored.senhaHash, process.env.DATABASE_URL];
    let cookie;

    async function request(path, options, expectedStatus) {
      const response = await fetch(new URL(path, base), options);
      assert.equal(response.status, expectedStatus, `HTTP esperado em ${path}`);
      const text = await response.text();
      for (const value of forbidden) {
        if (value) assert.ok(!text.includes(value), "Resposta deve ocultar segredos.");
      }
      assert.ok(!/senhaHash|senha_hash|scrypt\$/.test(text), "Resposta deve ocultar hash.");
      if (path.startsWith("/api/auth/")) {
        assert.ok(response.headers.get("cache-control")?.includes("no-store"));
      }
      return { response, body: text ? JSON.parse(text) : null };
    }

    const login = (payload) => ({
      method: "POST", headers: { "content-type": "application/json", origin: base.origin },
      body: JSON.stringify(payload),
    });
    const me = (value) => value ? { headers: { cookie: value } } : {};
    const sign = (claims, algorithm = "HS256", signingSecret = secret) => new SignJWT(claims)
      .setProtectedHeader({ alg: algorithm, typ: "JWT" })
      .sign(new TextEncoder().encode(signingSecret));

    await t.test("me sem sessão retorna 401", async () => {
      await request("/api/auth/me", {}, 401);
    });
    await t.test("login correto cria cookie e JWT HS256 de oito horas", async () => {
      const { response, body } = await request("/api/auth/login", login({ email, senha: password }), 200);
      assert.ok(JSON.stringify(body) === JSON.stringify(publicProfile), "Login deve retornar somente perfil público.");
      const setCookie = response.headers.get("set-cookie");
      assert.ok(setCookie?.startsWith("psicotask_session="));
      for (const pattern of [/HttpOnly/i, /SameSite=Lax/i, /Path=\//i, /Max-Age=28800/i]) {
        assert.ok(pattern.test(setCookie), "Atributo obrigatório do cookie.");
      }
      assert.ok(!/; Secure/i.test(setCookie), "Servidor testado deve estar em desenvolvimento.");
      cookie = setCookie.split(";")[0];
      const token = cookie.slice(cookie.indexOf("=") + 1);
      const claims = decodeJwt(token);
      assert.equal(decodeProtectedHeader(token).alg, "HS256");
      assert.deepEqual(Object.keys(claims).sort(), ["exp", "iat", "psicologoId"]);
      assert.equal(claims.psicologoId, id);
      assert.equal(claims.exp - claims.iat, 28800);
    });
    await t.test("me autenticado retorna o perfil persistido", async () => {
      const { body } = await request("/api/auth/me", me(cookie), 200);
      assert.ok(JSON.stringify(body) === JSON.stringify(publicProfile), "Me deve retornar somente perfil público.");
    });
    await t.test("email inexistente e senha incorreta têm a mesma resposta 401", async () => {
      const absent = await request("/api/auth/login", login({ email: `${randomBytes(12).toString("hex")}@tests.example`, senha: password }), 401);
      const wrong = await request("/api/auth/login", login({ email, senha: randomBytes(24).toString("hex") }), 401);
      assert.deepEqual(absent.body, wrong.body);
      assert.ok(!absent.response.headers.has("set-cookie") && !wrong.response.headers.has("set-cookie"));
    });
    await t.test("payloads inválidos, extras e JSON malformado retornam 400", async () => {
      for (const payload of [{}, { email: "invalido", senha: password }, { email, senha: "" }, { email, senha: password, psicologoId: id }]) {
        await request("/api/auth/login", login(payload), 400);
      }
      await request("/api/auth/login", { ...login({}), body: "{" }, 400);
    });
    await t.test("tokens inválidos, expirados, com outro algoritmo ou ID ausente retornam 401", async () => {
      const now = Math.floor(Date.now() / 1000);
      const claims = { psicologoId: id, iat: now, exp: now + 60 };
      for (const token of [
        "token-invalido", await sign(claims, "HS256", randomBytes(48).toString("hex")),
        await sign(claims, "HS384"), await sign({ ...claims, iat: now - 120, exp: now - 60 }),
        await sign({ ...claims, psicologoId: 2147483647 }),
      ]) await request("/api/auth/me", me(`psicotask_session=${token}`), 401);
    });
    await t.test("logout remove cookie e me volta a 401", async () => {
      const { response } = await request("/api/auth/logout", {
        method: "POST", headers: { cookie, origin: base.origin },
      }, 204);
      const setCookie = response.headers.get("set-cookie");
      assert.ok(setCookie?.startsWith("psicotask_session=;") && /Max-Age=0/i.test(setCookie));
      cookie = undefined;
      await request("/api/auth/me", me(cookie), 401);
    });
    await t.test("origem externa continua bloqueada no login e logout", async () => {
      await request("/api/auth/login", {
        ...login({ email, senha: password }),
        headers: { "content-type": "application/json", origin: "https://outro.example", "x-forwarded-host": "outro.example" },
      }, 403);
      await request("/api/auth/logout", {
        method: "POST", headers: { origin: "https://outro.example", "x-forwarded-host": "outro.example" },
      }, 403);
    });
    await t.test("CRUDs e Resumo exigem sessão e continuam acessíveis após login", async () => {
      const authenticated = await request("/api/auth/login", login({ email, senha: password }), 200);
      cookie = authenticated.response.headers.get("set-cookie").split(";")[0];
      for (const path of ["/api/perfil", "/api/contextos", "/api/tarefas", "/api/tarefas?status=PENDENTE&prioridade=ALTA", "/api/compromissos", "/api/resumo"]) {
        await request(path, {}, 401);
        await request(path, me(cookie), 200);
      }
    });
    await t.test("banco permanece intacto, inclusive hash do psicólogo", async () => {
      assert.deepEqual(await counts(), initialCounts);
      const current = await prisma.psicologo.findUnique({ where: { id } });
      assert.ok(JSON.stringify(current) === JSON.stringify(stored), "Auth não deve alterar o perfil ou hash.");
    });
  } finally {
    await prisma.$disconnect();
  }
});

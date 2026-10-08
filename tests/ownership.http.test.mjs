import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { config } from "dotenv";
import { createJiti } from "jiti";
import { SignJWT } from "jose";

// Opt-in, exclusivamente local. Executar separado de auth.http.test.mjs: ambos
// exigem o banco vazio de dados da aplicação. O finally limpa somente fixtures.
const baseUrl = process.env.AUTH_HTTP_BASE_URL;

test("Autenticação e ownership por HTTP real com duas sessões", { skip: !baseUrl }, async (t) => {
  const base = new URL(baseUrl);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(base.hostname), "Usar servidor local.");
  config({ quiet: true });
  const secret = process.env.AUTH_SECRET;
  const passwordA = process.env.DEV_PSYCHOLOGIST_PASSWORD;
  assert.ok(secret && Buffer.byteLength(secret) >= 32, "Configure AUTH_SECRET localmente.");
  assert.ok(passwordA?.trim(), "Configure DEV_PSYCHOLOGIST_PASSWORD localmente.");

  const jiti = createJiti(import.meta.url, { tsconfigPaths: true, fsCache: false });
  const { prisma } = await jiti.import("../src/lib/prisma.ts");
  const { hashPassword } = await jiti.import("../src/lib/auth/password.ts");
  const marker = `ownership-${randomBytes(12).toString("hex")}`;
  const passwordB = randomBytes(32).toString("hex");
  const forbidden = [secret, passwordA, passwordB, process.env.DATABASE_URL];
  let originalA;
  let userB;
  let baselineVerified = false;
  const users = [];
  const expectedCounts = { psicologo: 1, contexto: 0, tarefa: 0, compromisso: 0 };
  const counts = async () => ({
    psicologo: await prisma.psicologo.count(), contexto: await prisma.contexto.count(),
    tarefa: await prisma.tarefa.count(), compromisso: await prisma.compromisso.count(),
  });
  const ids = (records) => records.map(({ id }) => id).sort((a, b) => a - b);
  const publicProfile = ({ id, nome, email, registroProfissional }) => ({ id, nome, email, registroProfissional });
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const day = (offset) => {
    const date = new Date(`${today}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  };

  async function request(path, { method = "GET", cookie, body, rawBody } = {}, status = 200) {
    const headers = { origin: base.origin };
    if (cookie) headers.cookie = cookie;
    if (body !== undefined || rawBody !== undefined) headers["content-type"] = "application/json";
    const response = await fetch(new URL(path, base), {
      method, headers, body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    const text = await response.text();
    for (const value of forbidden) {
      if (value) assert.ok(!text.includes(value), "Resposta deve ocultar valores sensíveis.");
    }
    assert.ok(!/senhaHash|senha_hash|scrypt\$|AUTH_SECRET|DATABASE_URL|DEV_PSYCHOLOGIST_PASSWORD/.test(text), "Resposta deve ocultar detalhes sensíveis.");
    assert.equal(response.status, status, `${method} ${path}: status esperado`);
    return { response, body: text ? JSON.parse(text) : null };
  }
  async function login(user, password) {
    const result = await request("/api/auth/login", {
      method: "POST", body: { email: user.email, senha: password },
    });
    assert.deepEqual(result.body, publicProfile(user));
    const cookie = result.response.headers.get("set-cookie");
    assert.ok(cookie && /HttpOnly/i.test(cookie) && /SameSite=Lax/i.test(cookie) && /Path=\//i.test(cookie));
    return cookie.split(";")[0];
  }

  try {
    const [target] = await prisma.$queryRaw`SELECT current_database() AS database`;
    assert.ok(target.database === "psicotask_dev_v2", "Usar somente psicotask_dev_v2.");
    assert.deepEqual(await counts(), expectedCounts);
    [originalA] = await prisma.psicologo.findMany({ take: 2 });
    forbidden.push(originalA.senhaHash);
    baselineVerified = true;

    await t.test("todos os métodos protegidos rejeitam sessões ausentes, inválidas e expiradas antes de validar payload", async () => {
      const now = Math.floor(Date.now() / 1000);
      const expired = await new SignJWT({ psicologoId: originalA.id })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setIssuedAt(now - 120).setExpirationTime(now - 60)
        .sign(new TextEncoder().encode(secret));
      const absentUser = await new SignJWT({ psicologoId: 2147483647 })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setIssuedAt(now).setExpirationTime(now + 60)
        .sign(new TextEncoder().encode(secret));
      const endpoints = [
        ["GET", "/api/perfil"], ["PUT", "/api/perfil"], ["GET", "/api/resumo"],
        ...["contextos", "tarefas", "compromissos"].flatMap((resource) => [
          ["GET", `/api/${resource}`], ["POST", `/api/${resource}`],
          ["GET", `/api/${resource}/1`], ["PUT", `/api/${resource}/1`], ["DELETE", `/api/${resource}/1`],
          ["GET", `/api/${resource}/invalido`], ["PUT", `/api/${resource}/invalido`], ["DELETE", `/api/${resource}/invalido`],
        ]),
        ["GET", "/api/tarefas?status=INVALIDO"],
      ];
      for (const cookie of [undefined, "psicotask_session=invalido", `psicotask_session=${expired}`, `psicotask_session=${absentUser}`]) {
        for (const [method, path] of endpoints) {
          await request(path, {
            method, cookie, ...(["POST", "PUT"].includes(method) ? { rawBody: "{" } : {}),
          }, 401);
        }
      }
      assert.deepEqual(await counts(), expectedCounts);
    });

    const hashB = await hashPassword(passwordB);
    forbidden.push(hashB);
    userB = await prisma.psicologo.create({ data: {
      nome: `${marker}-B`, email: `${marker}@tests.example`,
      registroProfissional: marker, senhaHash: hashB,
    } });
    users.push(
      { ...originalA, label: "A", cookie: await login(originalA, passwordA), contexts: [], tasks: [], appointments: [] },
      { ...userB, label: "B", cookie: await login(userB, passwordB), contexts: [], tasks: [], appointments: [] },
    );
    assert.ok(users[0].cookie !== users[1].cookie, "As sessões devem ser independentes.");

    await t.test("Perfil e me usam exclusivamente a sessão; PUT mantém unicidade 409", async () => {
      for (const user of users) {
        for (const path of ["/api/perfil", "/api/auth/me"]) {
          assert.deepEqual((await request(path, { cookie: user.cookie })).body, publicProfile(user));
        }
        const updated = await request("/api/perfil", {
          method: "PUT", cookie: user.cookie, body: { nome: user.nome },
        });
        assert.deepEqual(updated.body, publicProfile(user));
      }
      for (const field of ["email", "registroProfissional"]) {
        await request("/api/perfil", {
          method: "PUT", cookie: users[1].cookie, body: { [field]: originalA[field] },
        }, 409);
      }
      for (const body of [{}, { email: "invalido" }, { id: originalA.id }, { psicologoId: originalA.id }]) {
        await request("/api/perfil", { method: "PUT", cookie: users[1].cookie, body }, 400);
      }
    });

    await t.test("Contextos, Tarefas e Compromissos persistem com o proprietário da sessão", async () => {
      for (const user of users) {
        for (const resource of ["contextos", "tarefas", "compromissos"]) {
          assert.deepEqual((await request(`/api/${resource}`, { cookie: user.cookie })).body, []);
        }
        assert.deepEqual((await request("/api/resumo", { cookie: user.cookie })).body, {
          tarefasPendentes: 0, tarefasPrioritarias: 0, proximosCompromissos: [],
        });
        for (let index = 0; index < 2; index++) {
          user.contexts.push((await request("/api/contextos", {
            method: "POST", cookie: user.cookie, body: { nome: `${marker}-${user.label}-contexto-${index}` },
          }, 201)).body);
        }
        const taskInputs = user.label === "A" ? [
          { status: "PENDENTE", prioridade: "ALTA", prazo: day(1) },
          { status: "EM_ANDAMENTO", prioridade: "ALTA", prazo: day(2) },
          { status: "CONCLUIDA", prioridade: "ALTA", prazo: day(1) },
        ] : [{ prazo: day(1) }, { status: "PENDENTE", prioridade: "ALTA", prazo: day(2) }];
        for (const [index, fields] of taskInputs.entries()) {
          const task = (await request("/api/tarefas", {
            method: "POST", cookie: user.cookie,
            body: { titulo: `${marker}-${user.label}-tarefa-${index}`, contextoId: user.contexts[0].id, ...fields },
          }, 201)).body;
          user.tasks.push(task);
          if (fields.status === undefined) {
            assert.equal(task.status, "PENDENTE"); assert.equal(task.prioridade, "MEDIA");
          }
        }
        const scheduled = user.label === "A" ? 7 : 2;
        for (let index = 0; index < scheduled + 3; index++) {
          user.appointments.push((await request("/api/compromissos", {
            method: "POST", cookie: user.cookie, body: {
              titulo: `${marker}-${user.label}-compromisso-${index}`,
              data: index === scheduled ? day(-1) : day(index % 3),
              horaInicio: `${String(8 + index).padStart(2, "0")}:00`,
              horaFim: `${String(9 + index).padStart(2, "0")}:00`,
              ...(index === scheduled + 1 ? { status: "CANCELADO" } : {}),
              ...(index === scheduled + 2 ? { status: "CONCLUIDO" } : {}),
            },
          }, 201)).body);
        }
        for (const [model, fixtures] of [["contexto", user.contexts], ["tarefa", user.tasks], ["compromisso", user.appointments]]) {
          const stored = await prisma[model].findMany({ where: { id: { in: ids(fixtures) } } });
          assert.equal(stored.length, fixtures.length);
          assert.ok(stored.every((record) => record.psicologoId === user.id), "FK deve corresponder à sessão.");
          for (const record of stored) {
            const source = fixtures.find(({ id }) => id === record.id);
            if (model === "tarefa") {
              assert.equal(record.contextoId, user.contexts[0].id);
              assert.equal(record.status, source.status); assert.equal(record.prioridade, source.prioridade);
              assert.equal(record.prazo.toISOString().slice(0, 10), source.prazo);
              assert.equal(record.dataCriacao.toISOString().slice(0, 10), source.dataCriacao);
            }
            if (model === "compromisso") {
              assert.equal(record.data.toISOString().slice(0, 10), source.data);
              assert.equal(record.horaInicio.toISOString().slice(11, 16), source.horaInicio);
              assert.equal(record.horaFim.toISOString().slice(11, 16), source.horaFim);
              assert.equal(record.status, source.status);
            }
          }
        }
      }
    });

    await t.test("listagens e acesso por ID são isolados nos dois sentidos, inclusive com owner na query", async () => {
      for (const [index, user] of users.entries()) {
        const other = users[1 - index];
        for (const [resource, property, update] of [
          ["contextos", "contexts", { nome: `${marker}-proibido` }],
          ["tarefas", "tasks", { titulo: `${marker}-proibido` }],
          ["compromissos", "appointments", { titulo: `${marker}-proibido` }],
        ]) {
          assert.deepEqual(ids((await request(`/api/${resource}`, { cookie: user.cookie })).body), ids(user[property]));
          assert.deepEqual(ids((await request(`/api/${resource}?psicologoId=${other.id}`, { cookie: user.cookie })).body), ids(user[property]));
          for (const own of user[property]) {
            assert.deepEqual((await request(`/api/${resource}/${own.id}`, { cookie: user.cookie })).body, own);
          }
          const path = `/api/${resource}/${other[property][0].id}`;
          await request(path, { cookie: user.cookie }, 404);
          await request(path, { method: "PUT", cookie: user.cookie, body: update }, 404);
          await request(path, { method: "DELETE", cookie: user.cookie }, 404);
        }
        await request("/api/tarefas", {
          method: "POST", cookie: user.cookie,
          body: { titulo: `${marker}-contexto-alheio`, contextoId: other.contexts[0].id },
        }, 404);
        await request(`/api/tarefas/${user.tasks[0].id}`, {
          method: "PUT", cookie: user.cookie, body: { contextoId: other.contexts[0].id },
        }, 404);
        await request("/api/tarefas", {
          method: "POST", cookie: user.cookie,
          body: { titulo: `${marker}-contexto-ausente`, contextoId: 2147483647 },
        }, 404);
      }
    });

    await t.test("requisições HTTP simultâneas mantêm o proprietário de cada sessão", async () => {
      await Promise.all(Array.from({ length: 4 }, () => users.map(async (user) => {
        const [contexts, tasks, appointments, profile] = await Promise.all([
          request("/api/contextos", { cookie: user.cookie }),
          request("/api/tarefas", { cookie: user.cookie }),
          request("/api/compromissos", { cookie: user.cookie }),
          request("/api/perfil", { cookie: user.cookie }),
        ]);
        assert.deepEqual(ids(contexts.body), ids(user.contexts));
        assert.deepEqual(ids(tasks.body), ids(user.tasks));
        assert.deepEqual(ids(appointments.body), ids(user.appointments));
        assert.equal(profile.body.id, user.id);
      })).flat());
    });

    await t.test("PUT parcial preserva campos e valida os horários finais persistidos", async () => {
      for (const user of users) {
        const originalContext = user.contexts[0];
        user.contexts[0] = (await request(`/api/contextos/${originalContext.id}`, {
          method: "PUT", cookie: user.cookie, body: { descricao: "Descrição temporária" },
        })).body;
        assert.equal(user.contexts[0].nome, originalContext.nome);
        const originalTask = user.tasks[0];
        user.tasks[0] = (await request(`/api/tarefas/${originalTask.id}`, {
          method: "PUT", cookie: user.cookie,
          body: { descricao: "Descrição temporária", contextoId: user.contexts[1].id },
        })).body;
        assert.equal(user.tasks[0].titulo, originalTask.titulo);
        assert.equal(user.tasks[0].status, originalTask.status);
        const appointment = user.appointments[0];
        for (const body of [{ data: day(1) }, { horaInicio: "08:30" }, { horaFim: "09:30" }]) {
          user.appointments[0] = (await request(`/api/compromissos/${appointment.id}`, {
            method: "PUT", cookie: user.cookie, body,
          })).body;
        }
        for (const body of [{ horaInicio: "09:30" }, { horaFim: "08:00" }]) {
          await request(`/api/compromissos/${appointment.id}`, { method: "PUT", cookie: user.cookie, body }, 400);
        }
        assert.deepEqual((await request(`/api/compromissos/${appointment.id}`, { cookie: user.cookie })).body, user.appointments[0]);
        const storedTask = await prisma.tarefa.findUnique({ where: { id: originalTask.id } });
        assert.equal(storedTask.contextoId, user.contexts[1].id);
        assert.equal(storedTask.psicologoId, user.id);
      }
    });

    await t.test("filtros RF06 combinados e totais por status correspondem ao PostgreSQL do usuário", async () => {
      for (const user of users) {
        for (const filters of [
          { status: "PENDENTE" }, { status: "EM_ANDAMENTO" }, { status: "CONCLUIDA" },
          { prioridade: "ALTA" }, { prazo: day(1) }, { status: "PENDENTE", prioridade: "ALTA" },
        ]) {
          const result = await request(`/api/tarefas?${new URLSearchParams(filters)}`, { cookie: user.cookie });
          const expected = user.tasks.filter((task) => Object.entries(filters).every(([key, value]) => task[key] === value));
          assert.deepEqual(ids(result.body), ids(expected));
          const where = { psicologoId: user.id, ...filters };
          if (filters.prazo) where.prazo = new Date(`${filters.prazo}T00:00:00.000Z`);
          assert.equal(await prisma.tarefa.count({ where }), expected.length);
        }
        assert.equal(await prisma.tarefa.count({ where: { psicologoId: user.id } }), user.tasks.length);
        for (const query of ["status=INVALIDO", "prioridade=URGENTE", "prazo=abc", "status=PENDENTE&status=CONCLUIDA"]) {
          await request(`/api/tarefas?${query}`, { cookie: user.cookie }, 400);
        }
      }
    });

    await t.test("Resumo isola contagens, ordena compromissos, aplica limite cinco e exclui passado/cancelados/concluídos", async () => {
      for (const user of users) {
        const expected = {
          tarefasPendentes: user.tasks.filter(({ status }) => status === "PENDENTE").length,
          tarefasPrioritarias: user.tasks.filter(({ status, prioridade }) => prioridade === "ALTA" && status !== "CONCLUIDA").length,
          proximosCompromissos: user.appointments.filter(({ status, data }) => status === "AGENDADO" && data >= today)
            .sort((a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio)).slice(0, 5),
        };
        assert.deepEqual((await request("/api/resumo", { cookie: user.cookie })).body, expected);
        assert.equal(expected.proximosCompromissos.length, user.label === "A" ? 5 : 2);
      }
    });

    await t.test("400 para payloads protegidos/vazios e IDs inválidos; 404 para IDs inexistentes", async () => {
      const user = users[0];
      const fixtures = [
        ["contextos", user.contexts[0].id, { nome: `${marker}-invalido` }],
        ["tarefas", user.tasks[0].id, { titulo: `${marker}-invalido`, contextoId: user.contexts[0].id }],
        ["compromissos", user.appointments[0].id, { titulo: `${marker}-invalido`, data: day(1), horaInicio: "10:00", horaFim: "11:00" }],
      ];
      for (const [resource, id, valid] of fixtures) {
        for (const protectedField of ["id", "psicologoId", "psicologo_fk"]) {
          const body = { ...valid, [protectedField]: users[1].id };
          await request(`/api/${resource}`, { method: "POST", cookie: user.cookie, body }, 400);
          await request(`/api/${resource}/${id}`, { method: "PUT", cookie: user.cookie, body }, 400);
        }
        await request(`/api/${resource}`, { method: "POST", cookie: user.cookie, body: {} }, 400);
        await request(`/api/${resource}/${id}`, { method: "PUT", cookie: user.cookie, body: {} }, 400);
        for (const invalidId of ["0", "-1", "1.5", "abc", "2147483648"]) {
          for (const method of ["GET", "PUT", "DELETE"]) {
            await request(`/api/${resource}/${invalidId}`, {
              method, cookie: user.cookie, ...(method === "PUT" ? { body: valid } : {}),
            }, 400);
          }
        }
        for (const method of ["GET", "PUT", "DELETE"]) {
          await request(`/api/${resource}/2147483647`, {
            method, cookie: user.cookie, ...(method === "PUT" ? { body: valid } : {}),
          }, 404);
        }
      }
      await request("/api/compromissos", {
        method: "POST", cookie: user.cookie, body: { ...fixtures[2][2], status: "INVALIDO" },
      }, 400);
      await request("/api/tarefas", {
        method: "POST", cookie: user.cookie, body: { ...fixtures[1][2], dataCriacao: today },
      }, 400);
    });

    await t.test("RESTRICT retorna 409 sem alterar contexto/tarefas; DELETE remove contextos sem vínculos", async () => {
      for (const user of users) {
        const protectedContextId = user.contexts[1].id;
        const beforeContext = await prisma.contexto.findUnique({ where: { id: protectedContextId } });
        const beforeTasks = await prisma.tarefa.findMany({ where: { contextoId: protectedContextId }, orderBy: { id: "asc" } });
        assert.ok(beforeContext);
        assert.ok(beforeTasks.length > 0, "O contexto deve possuir tarefas persistidas antes da exclusão.");
        const path = `/api/contextos/${protectedContextId}`;
        await request(path, { method: "DELETE" }, 401);
        const other = users.find(({ id }) => id !== user.id);
        await request(path, { method: "DELETE", cookie: other.cookie }, 404);
        const result = await request(path, { method: "DELETE", cookie: user.cookie }, 409);
        assert.deepEqual(result.body, {
          error: "Não é possível excluir um contexto que possui tarefas vinculadas.",
        });
        assert.deepEqual(await prisma.contexto.findUnique({ where: { id: protectedContextId } }), beforeContext);
        assert.deepEqual(
          await prisma.tarefa.findMany({ where: { contextoId: protectedContextId }, orderBy: { id: "asc" } }),
          beforeTasks,
        );
        assert.deepEqual((await request(path, { cookie: user.cookie })).body, user.contexts[1]);
        for (const [resource, model, records] of [
          ["tarefas", "tarefa", user.tasks], ["compromissos", "compromisso", user.appointments],
          ["contextos", "contexto", user.contexts],
        ]) {
          for (const { id } of records) {
            await request(`/api/${resource}/${id}`, { method: "DELETE", cookie: user.cookie }, 204);
            assert.equal(await prisma[model].count({ where: { id } }), 0);
            await request(`/api/${resource}/${id}`, { cookie: user.cookie }, 404);
          }
          assert.deepEqual((await request(`/api/${resource}`, { cookie: user.cookie })).body, []);
        }
        assert.deepEqual((await request("/api/resumo", { cookie: user.cookie })).body, {
          tarefasPendentes: 0, tarefasPrioritarias: 0, proximosCompromissos: [],
        });
      }
    });

    await t.test("logout de A não encerra sessão independente de B", async () => {
      const result = await request("/api/auth/logout", { method: "POST", cookie: users[0].cookie }, 204);
      const cleared = result.response.headers.get("set-cookie");
      assert.ok(cleared?.startsWith("psicotask_session=;") && /Max-Age=0/i.test(cleared));
      users[0].cookie = undefined;
      await request("/api/auth/me", {}, 401);
      await request("/api/perfil", {}, 401);
      await request("/api/auth/me", { cookie: users[1].cookie });
      await request("/api/perfil", { cookie: users[1].cookie });
      await request("/api/auth/logout", { method: "POST", cookie: users[1].cookie }, 204);
      users[1].cookie = undefined;
    });
  } finally {
    try {
      if (baselineVerified) {
        // Marcador aleatório + IDs dos usuários limitam a limpeza estritamente às fixtures.
        const psicologoId = { in: [originalA.id, ...(userB ? [userB.id] : [])] };
        await prisma.tarefa.deleteMany({ where: { psicologoId, titulo: { startsWith: marker } } });
        await prisma.compromisso.deleteMany({ where: { psicologoId, titulo: { startsWith: marker } } });
        await prisma.contexto.deleteMany({ where: { psicologoId, nome: { startsWith: marker } } });
        if (userB) await prisma.psicologo.delete({ where: { id: userB.id, email: userB.email } });
        const currentA = await prisma.psicologo.findUnique({ where: { id: originalA.id } });
        assert.ok(JSON.stringify(currentA) === JSON.stringify(originalA), "Perfil original e hash devem permanecer intactos.");
        assert.deepEqual(await counts(), expectedCounts);
      }
    } finally {
      await prisma.$disconnect();
    }
  }
});

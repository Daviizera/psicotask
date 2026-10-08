import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";

// Testes isolados: não carregam .env nem abrem conexão com o PostgreSQL.
const previousDatabaseUrl = process.env.DATABASE_URL;
const previousNodeEnv = process.env.NODE_ENV;
const previousPrisma = globalThis.psicoPrisma;
const previousSessionId = globalThis.psicoTestSessionPsychologistId;
process.env.DATABASE_URL = "postgresql://unused.invalid/isolated_tests";
process.env.NODE_ENV = "test";

const publicFields = { id: true, nome: true, descricao: true };
let state;
let calls;
let Prisma;

function knownError(code) {
  return new Prisma.PrismaClientKnownRequestError("DETALHE_INTERNO_NAO_EXPOR", {
    code,
    clientVersion: "7.10.0",
  });
}

function recordCall(method, options) {
  calls.push({ method, options });
  if (state.errors[method]) throw state.errors[method];
}

function selectPublic(record, select) {
  assert.deepEqual(select, publicFields, "O repository deve consultar somente campos públicos.");
  return Object.fromEntries(Object.keys(select).map((key) => [key, record[key]]));
}

function matches(record, where) {
  assert.equal(typeof where.psicologoId, "number", "Toda operação deve limitar o proprietário.");
  return record.psicologoId === where.psicologoId &&
    (where.id === undefined || record.id === where.id);
}

globalThis.psicoPrisma = {
  psicologo: {
    async findUnique(options) {
      recordCall("resolveOwner", options);
      assert.deepEqual(options.select, { id: true });
      assert.equal(options.where.id, globalThis.psicoTestSessionPsychologistId);
      return state.ownerIds.includes(options.where.id) ? { id: options.where.id } : null;
    },
  },
  contexto: {
    async findMany(options) {
      recordCall("findMany", options);
      return state.records.filter((record) => matches(record, options.where))
        .map((record) => selectPublic(record, options.select));
    },
    async findFirst(options) {
      recordCall("findFirst", options);
      const record = state.records.find((record) => matches(record, options.where));
      return record ? selectPublic(record, options.select) : null;
    },
    async create(options) {
      recordCall("create", options);
      assert.deepEqual(Object.keys(options.data).sort(), ["descricao", "nome", "psicologoId"]);
      const record = { ...options.data, id: state.nextId++, descricao: options.data.descricao ?? null };
      state.records.push(record);
      return selectPublic(record, options.select);
    },
    async update(options) {
      recordCall("update", options);
      const record = state.records.find((record) => matches(record, options.where));
      if (!record) throw knownError("P2025");
      assert.deepEqual(Object.keys(options.data).sort(), ["descricao", "nome"]);
      for (const [key, value] of Object.entries(options.data)) {
        if (value !== undefined) record[key] = value;
      }
      return selectPublic(record, options.select);
    },
    async deleteMany(options) {
      recordCall("deleteMany", options);
      const originalCount = state.records.length;
      state.records = state.records.filter((record) => !matches(record, options.where));
      return { count: originalCount - state.records.length };
    },
  },
};

const jiti = createJiti(import.meta.url, {
  // O alias explícito evita carregar cookies() fora de uma requisição Next.js.
  tsconfigPaths: false,
  fsCache: false,
  alias: {
    "@": fileURLToPath(new URL("../src", import.meta.url)),
    "@/lib/auth/request-session": fileURLToPath(new URL("./helpers/request-session.mjs", import.meta.url)),
  },
});
({ Prisma } = await jiti.import("../src/generated/prisma/client.ts"));
const { contextSchema, contextIdParamSchema, createContextSchema, updateContextSchema } =
  await jiti.import("../src/modules/contextos/schemas/context.schema.ts");
const { PrismaContextRepository } = await jiti.import(
  "../src/modules/contextos/repositories/prisma-context.repository.ts",
);
const { ContextHasTasksError, CONTEXT_HAS_TASKS } = await jiti.import(
  "../src/modules/contextos/errors/context-has-tasks.error.ts",
);
const { InMemoryContextRepository } = await jiti.import(
  "../src/modules/contextos/repositories/in-memory-context.repository.ts",
);
const { ContextService } = await jiti.import("../src/modules/contextos/services/context.service.ts");
const collection = await jiti.import("../src/app/api/contextos/route.ts");
const item = await jiti.import("../src/app/api/contextos/[id]/route.ts");

beforeEach(() => {
  globalThis.psicoTestSessionPsychologistId = 17;
  calls = [];
  state = {
    ownerIds: [17, 83],
    nextId: 30,
    records: [
      { id: 7, psicologoId: 17, nome: "Contexto atual", descricao: null },
      { id: 8, psicologoId: 83, nome: "Contexto de outro psicólogo", descricao: "Reservado" },
    ],
    errors: {},
  };
});

after(() => {
  if (previousSessionId === undefined) delete globalThis.psicoTestSessionPsychologistId;
  else globalThis.psicoTestSessionPsychologistId = previousSessionId;
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  if (previousPrisma === undefined) delete globalThis.psicoPrisma;
  else globalThis.psicoPrisma = previousPrisma;
});

function request(method, body) {
  return new Request("http://localhost/api/contextos", {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function routeContext(id) {
  return { params: Promise.resolve({ id: String(id) }) };
}

async function assertInvalid(response) {
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error, "Dados inválidos");
  assert.ok(Array.isArray(body.details));
}

test("schemas aceitam ID INTEGER positivo, nome até 200 caracteres e descrição opcional", () => {
  assert.deepEqual(contextSchema.parse({ id: 7, nome: " Nome " }), { id: 7, nome: "Nome" });
  assert.equal(contextSchema.safeParse({ id: 2147483647, nome: "Nome" }).success, true);
  for (const id of ["7", 0, -1, 1.5, 2147483648, Infinity, NaN]) {
    assert.equal(contextSchema.safeParse({ id, nome: "Nome" }).success, false);
  }
  assert.equal(createContextSchema.safeParse({ nome: "N".repeat(200) }).success, true);
  assert.equal(createContextSchema.safeParse({ nome: "N".repeat(201) }).success, false);
  assert.deepEqual(createContextSchema.parse({ nome: "Nome", descricao: "" }), { nome: "Nome", descricao: "" });
});

test("schemas rejeitam campos protegidos, desconhecidos e payloads inválidos", () => {
  const invalid = [null, [], {}, { nome: " " }, { nome: 7 }, { nome: "Nome", descricao: null }];
  for (const body of invalid) assert.equal(createContextSchema.safeParse(body).success, false);
  for (const field of ["id", "psicologoId", "psicologo_fk", "outro"]) {
    const body = { nome: "Nome", [field]: 83 };
    assert.equal(createContextSchema.safeParse(body).success, false);
    assert.equal(updateContextSchema.safeParse(body).success, false);
  }
  for (const body of [{}, { nome: undefined }, { descricao: undefined }, { nome: " " }, { descricao: null }]) {
    assert.equal(updateContextSchema.safeParse(body).success, false);
  }
  assert.deepEqual(updateContextSchema.parse({ descricao: "Descrição nova" }), { descricao: "Descrição nova" });
});

test("schema de URL converte dígitos e rejeita IDs fora do domínio INTEGER positivo", () => {
  for (const [input, output] of [["1", 1], ["25", 25], ["01", 1], ["2147483647", 2147483647]]) {
    assert.equal(contextIdParamSchema.parse(input), output);
  }
  for (const input of ["", "0", "-1", "1.5", "1e2", "+1", " 1", "1 ", "abc", "0x10", "2147483648", "999999999999999999999999", "a-b-c"]) {
    assert.equal(contextIdParamSchema.safeParse(input).success, false, input);
  }
});

test("repository limita listagem e busca ao proprietário e omite descricao NULL", async () => {
  const repository = new PrismaContextRepository();
  assert.deepEqual(await repository.findAll(), [{ id: 7, nome: "Contexto atual" }]);
  assert.deepEqual(await repository.findById(7), { id: 7, nome: "Contexto atual" });
  assert.equal(await repository.findById(8), null);
  assert.equal(await repository.findById(999), null);
});

test("repository define proprietário no backend e ignora campos protegidos na criação", async () => {
  const created = await new PrismaContextRepository().create({
    nome: "Novo", descricao: "", id: 999, psicologoId: 83, psicologo_fk: 83,
  });
  assert.deepEqual(created, { id: 30, nome: "Novo", descricao: "" });
  assert.equal(state.records.find(({ id }) => id === 30).psicologoId, 17);
});

test("repository atualiza parcialmente sem mudar ID/proprietário e isola outro proprietário", async () => {
  const repository = new PrismaContextRepository();
  const foreignBefore = { ...state.records[1] };
  assert.deepEqual(await repository.update(7, { nome: "Alterado", id: 999, psicologoId: 83, psicologo_fk: 83 }), {
    id: 7, nome: "Alterado",
  });
  assert.deepEqual(await repository.update(7, { descricao: "Somente descrição" }), {
    id: 7, nome: "Alterado", descricao: "Somente descrição",
  });
  assert.deepEqual(await repository.update(7, { descricao: "" }), { id: 7, nome: "Alterado", descricao: "" });
  assert.equal(state.records[0].psicologoId, 17);
  assert.equal(await repository.update(8, { nome: "Indevido" }), null);
  assert.equal(await repository.update(999, { nome: "Ausente" }), null);
  assert.deepEqual(state.records[1], foreignBefore);
});

test("repository exclui somente registros do proprietário atual", async () => {
  const repository = new PrismaContextRepository();
  assert.equal(await repository.delete(8), false);
  assert.equal(await repository.delete(999), false);
  assert.equal(await repository.delete(7), true);
  assert.equal(await repository.delete(7), false);
  assert.deepEqual(state.records.map(({ id }) => id), [8]);
});

test("repository resolve novamente o proprietário em cada operação, sem ID fixo", async () => {
  const repository = new PrismaContextRepository();
  await repository.findAll();
  globalThis.psicoTestSessionPsychologistId = 83;
  assert.deepEqual(await repository.findAll(), [{ id: 8, nome: "Contexto de outro psicólogo", descricao: "Reservado" }]);
  assert.equal(await repository.findById(7), null);
  assert.equal((await repository.findById(8)).id, 8);
  const created = await repository.create({ nome: "Outro proprietário" });
  assert.equal(state.records.find(({ id }) => id === created.id).psicologoId, 83);
  assert.equal(await repository.update(7, { nome: "Indevido" }), null);
  assert.equal((await repository.update(8, { nome: "Permitido" })).nome, "Permitido");
  assert.equal(await repository.delete(7), false);
  assert.equal(await repository.delete(8), true);
  assert.equal(calls.filter(({ method }) => method === "resolveOwner").length, 9);
});

test("repository traduz somente P2003 de exclusão em conflito de contexto vinculado, sem pré-consulta", async () => {
  const repository = new PrismaContextRepository();
  const before = structuredClone(state.records);
  state.errors.deleteMany = knownError("P2003");
  await assert.rejects(repository.delete(7), (error) => {
    assert.ok(error instanceof ContextHasTasksError);
    assert.equal(error.code, CONTEXT_HAS_TASKS);
    assert.equal(error.message, "Não é possível excluir um contexto que possui tarefas vinculadas.");
    assert.ok(!error.message.includes("DETALHE_INTERNO_NAO_EXPOR"));
    return true;
  });
  assert.deepEqual(state.records, before);
  assert.deepEqual(calls.map(({ method }) => method), ["resolveOwner", "deleteMany"]);
  assert.deepEqual(calls[1].options, { where: { id: 7, psicologoId: 17 } });
});

test("repository propaga outros erros de exclusão, sem convertê-los em conflito ou ausência", async () => {
  const repository = new PrismaContextRepository();
  for (const error of [
    knownError("P2025"), knownError("P2002"), new Error("DETALHE_INTERNO_NAO_EXPOR"),
    Object.assign(new Error("DETALHE_INTERNO_NAO_EXPOR"), { code: "P2003" }),
  ]) {
    state.errors.deleteMany = error;
    await assert.rejects(repository.delete(7), (caught) => caught === error);
  }
  assert.equal(state.records.length, 2);
  state.errors.update = new Error("DETALHE_INTERNO_NAO_EXPOR");
  await assert.rejects(repository.update(7, { nome: "Novo" }), (error) => error === state.errors.update);
});

test("Service com repository em memória mantém CRUD numérico, cópias e atualização parcial", async () => {
  const service = new ContextService(new InMemoryContextRepository());
  const initial = await service.findAll();
  assert.ok(initial.every((context) => contextSchema.safeParse(context).success));
  const created = await service.create({ nome: "Teste", descricao: "Preservada" });
  assert.equal(typeof created.id, "number");
  assert.equal(initial.some(({ id }) => id === created.id), false);
  const updated = await service.update(created.id, { nome: "Novo nome" });
  assert.deepEqual(updated, { ...created, nome: "Novo nome" });
  updated.nome = "Mutação externa";
  assert.equal((await service.findById(created.id)).nome, "Novo nome");
  assert.equal(await service.delete(created.id), true);
  assert.equal(await service.findById(created.id), null);
  assert.equal(await service.update(created.id, { nome: "Ausente" }), null);
  assert.equal(await service.delete(created.id), false);
});

test("container real utiliza Prisma no CRUD completo das rotas", async () => {
  const listResponse = await collection.GET(request("GET"));
  assert.equal(listResponse.status, 200);
  assert.deepEqual(await listResponse.json(), [{ id: 7, nome: "Contexto atual" }]);
  const createResponse = await collection.POST(request("POST", { nome: " Novo " }));
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();
  assert.deepEqual(created, { id: 30, nome: "Novo" });
  const found = await item.GET(request("GET"), routeContext(created.id));
  assert.equal(found.status, 200);
  assert.deepEqual(await found.json(), created);
  const renamed = await item.PUT(request("PUT", { nome: "Renomeado" }), routeContext(created.id));
  assert.equal(renamed.status, 200);
  const described = await item.PUT(request("PUT", { descricao: "Descrição" }), routeContext(created.id));
  assert.equal(described.status, 200);
  assert.deepEqual(await described.json(), { id: created.id, nome: "Renomeado", descricao: "Descrição" });
  const deleted = await item.DELETE(request("DELETE"), routeContext(created.id));
  assert.equal(deleted.status, 204);
  assert.equal(await deleted.text(), "");
  assert.equal(state.records.some(({ id }) => id === created.id), false);
  assert.ok(calls.some(({ method }) => method === "create"));
});

test("POST e PUT retornam 400 para corpos inválidos/protegidos antes de consultar os dados do módulo", async () => {
  const invalid = [
    {}, null, [], { nome: " " }, { nome: 1 }, { nome: "N".repeat(201) },
    { nome: "Nome", descricao: null }, { nome: "Nome", id: 83 },
    { nome: "Nome", psicologoId: 83 }, { nome: "Nome", psicologo_fk: 83 },
    { nome: "Nome", desconhecido: true },
  ];
  for (const body of invalid) {
    await assertInvalid(await collection.POST(request("POST", body)));
    await assertInvalid(await item.PUT(request("PUT", body), routeContext(7)));
  }
  for (const method of ["POST", "PUT"]) {
    const malformed = new Request("http://localhost/api/contextos", { method, body: "{" });
    const response = method === "POST" ? await collection.POST(malformed) : await item.PUT(malformed, routeContext(7));
    await assertInvalid(response);
  }
  assert.ok(calls.length > 0);
  assert.ok(calls.every(({ method }) => method === "resolveOwner"));
});

test("GET/PUT/DELETE rejeitam IDs malformados com 400 antes de consultar os dados do módulo", async () => {
  for (const id of ["0", "-1", "1.5", "abc", "1e2", "+1", "1 ", "0x10", "2147483648", "999999999999999999999999"]) {
    await assertInvalid(await item.GET(request("GET"), routeContext(id)));
    await assertInvalid(await item.PUT(request("PUT", { nome: "Nome" }), routeContext(id)));
    await assertInvalid(await item.DELETE(request("DELETE"), routeContext(id)));
  }
  assert.ok(calls.length > 0);
  assert.ok(calls.every(({ method }) => method === "resolveOwner"));
});

test("GET/PUT/DELETE retornam o mesmo 404 para ID ausente ou de outro proprietário", async () => {
  const foreignBefore = { ...state.records[1] };
  for (const id of [8, 999, 2147483647]) {
    for (const response of [
      await item.GET(request("GET"), routeContext(id)),
      await item.PUT(request("PUT", { nome: "Indevido" }), routeContext(id)),
      await item.DELETE(request("DELETE"), routeContext(id)),
    ]) {
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: "Recurso não encontrado" });
    }
  }
  assert.deepEqual(state.records[1], foreignBefore);
});

test("todos os handlers ocultam detalhes de erros inesperados em respostas 500", async () => {
  for (const method of ["findMany", "findFirst", "create", "update", "deleteMany"]) {
    state.errors[method] = new Error("DETALHE_INTERNO_NAO_EXPOR");
  }
  for (const response of [
    await collection.GET(request("GET")),
    await collection.POST(request("POST", { nome: "Novo" })),
    await item.GET(request("GET"), routeContext(7)),
    await item.PUT(request("PUT", { nome: "Novo" }), routeContext(7)),
    await item.DELETE(request("DELETE"), routeContext(7)),
  ]) {
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "Erro interno do servidor" });
  }
});

test("DELETE retorna 409 para contexto vinculado sem expor Prisma, constraint, SQL ou stack", async () => {
  const before = structuredClone(state.records);
  state.errors.deleteMany = knownError("P2003");
  const response = await item.DELETE(request("DELETE"), routeContext(7));
  assert.equal(response.status, 409);
  const text = await response.text();
  assert.deepEqual(JSON.parse(text), {
    error: "Não é possível excluir um contexto que possui tarefas vinculadas.",
  });
  assert.ok(!/Prisma|P2003|constraint|DELETE FROM|stack|DETALHE_INTERNO_NAO_EXPOR/i.test(text));
  assert.deepEqual(state.records, before);
  assert.equal(calls.filter(({ method }) => method === "deleteMany").length, 1);
  assert.ok(calls.every(({ method }) => ["resolveOwner", "deleteMany"].includes(method)));
});

test("DELETE mantém 500 genérico para erros inesperados, inclusive outros códigos Prisma", async () => {
  for (const error of [
    knownError("P2025"), knownError("P2002"), new Error("DETALHE_INTERNO_NAO_EXPOR"),
    Object.assign(new Error("DETALHE_INTERNO_NAO_EXPOR"), { code: "P2003" }),
  ]) {
    state.errors.deleteMany = error;
    const response = await item.DELETE(request("DELETE"), routeContext(7));
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "Erro interno do servidor" });
  }
  assert.equal(state.records.some(({ id }) => id === 7), true);
});

test("handlers exigem sessão antes de validar payload, filtros e ID", async () => {
  globalThis.psicoTestSessionPsychologistId = null;
  for (const response of [
    await collection.GET(request("GET")),
    await collection.POST(request("POST", {})),
    await item.GET(request("GET"), routeContext("inválido")),
    await item.PUT(request("PUT", {}), routeContext("inválido")),
    await item.DELETE(request("DELETE"), routeContext("inválido")),
  ]) {
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { error: "Não autenticado" });
  }
  assert.equal(calls.length, 0);
});

test("sessão de proprietário removido não acessa dados do módulo", async () => {
  state.ownerIds = [83];
  for (const response of [
    await collection.GET(request("GET")),
    await item.GET(request("GET"), routeContext(7)),
    await item.PUT(request("PUT", { nome: "Alteração" }), routeContext(7)),
    await item.DELETE(request("DELETE"), routeContext(7)),
  ]) {
    assert.equal(response.status, 401);
  }
  assert.ok(calls.every(({ method }) => method === "resolveOwner"));
});

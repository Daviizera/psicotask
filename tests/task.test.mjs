import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";

// Testes isolados: não carregam .env nem abrem conexão com PostgreSQL.
const previousDatabaseUrl = process.env.DATABASE_URL;
const previousNodeEnv = process.env.NODE_ENV;
const previousPrisma = globalThis.psicoPrisma;
const previousSessionId = globalThis.psicoTestSessionPsychologistId;
process.env.DATABASE_URL = "postgresql://unused.invalid/isolated_tests";
process.env.NODE_ENV = "test";

const publicFields = {
  id: true, contextoId: true, titulo: true, descricao: true,
  status: true, prioridade: true, prazo: true, dataCriacao: true,
};
const writableFields = ["contextoId", "titulo", "descricao", "status", "prioridade", "prazo"];
let state;
let calls;
let Prisma;

function knownError(code) {
  return new Prisma.PrismaClientKnownRequestError("DETALHE_INTERNO_NAO_EXPOR", {
    code, clientVersion: "7.10.0",
  });
}

function recordCall(method, options) {
  calls.push({ method, options });
  if (state.errors[method]) throw state.errors[method];
}

function selectPublic(record, select) {
  assert.deepEqual(select, publicFields, "Somente campos públicos devem ser selecionados.");
  return Object.fromEntries(Object.keys(select).map((key) => [key, record[key]]));
}

function matches(record, where) {
  assert.equal(typeof where.psicologoId, "number", "Toda operação deve limitar o proprietário.");
  if (record.psicologoId !== where.psicologoId) return false;
  for (const key of ["id", "status", "prioridade"]) {
    if (where[key] !== undefined && where[key] !== record[key]) return false;
  }
  if (where.prazo !== undefined) {
    assert.ok(where.prazo instanceof Date);
    if (record.prazo?.getTime() !== where.prazo.getTime()) return false;
  }
  return true;
}

function assertWritable(data, creating) {
  const allowed = new Set([...writableFields, ...(creating ? ["psicologoId"] : [])]);
  assert.ok(Object.keys(data).every((key) => allowed.has(key)), "IDs, proprietário e data de criação não podem ser controlados pelo payload.");
  if (data.prazo !== undefined) assert.ok(data.prazo instanceof Date);
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
    async findFirst(options) {
      recordCall("findContext", options);
      assert.deepEqual(options.select, { id: true });
      const context = state.contexts.find((record) => matches(record, options.where));
      return context ? { id: context.id } : null;
    },
  },
  tarefa: {
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
      assertWritable(options.data, true);
      const record = {
        ...options.data,
        id: state.nextId++,
        descricao: options.data.descricao ?? null,
        prazo: options.data.prazo ?? null,
        dataCriacao: new Date("2026-01-01T00:00:00.000Z"),
      };
      state.records.push(record);
      return selectPublic(record, options.select);
    },
    async update(options) {
      recordCall("update", options);
      const record = state.records.find((record) => matches(record, options.where));
      if (!record) throw knownError("P2025");
      assertWritable(options.data, false);
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
const { taskSchema, createTaskSchema, updateTaskSchema, taskFiltersSchema, taskIdParamSchema } =
  await jiti.import("../src/modules/tarefas/schemas/task.schema.ts");
const { PrismaTaskRepository } = await jiti.import(
  "../src/modules/tarefas/repositories/prisma-task.repository.ts",
);
const { InMemoryTaskRepository } = await jiti.import(
  "../src/modules/tarefas/repositories/in-memory-task.repository.ts",
);
const { TaskService } = await jiti.import("../src/modules/tarefas/services/task.service.ts");
const { TaskContextNotFoundError } = await jiti.import(
  "../src/modules/tarefas/errors/task-context-not-found.error.ts",
);
// No Windows, jiti resolve aliases com barras invertidas e imports relativos
// com barras normais. Compartilha o módulo para preservar a identidade da classe.
jiti.cache[jiti.resolve("@/modules/tarefas/errors/task-context-not-found.error")] =
  jiti.cache[jiti.resolve("../src/modules/tarefas/errors/task-context-not-found.error.ts")];
const collection = await jiti.import("../src/app/api/tarefas/route.ts");
const item = await jiti.import("../src/app/api/tarefas/[id]/route.ts");

beforeEach(() => {
  globalThis.psicoTestSessionPsychologistId = 17;
  calls = [];
  state = {
    ownerIds: [17, 83],
    nextId: 30,
    contexts: [
      { id: 70, psicologoId: 17 }, { id: 71, psicologoId: 17 }, { id: 80, psicologoId: 83 },
    ],
    records: [
      {
        id: 7, psicologoId: 17, contextoId: 70, titulo: "Tarefa atual", descricao: null,
        status: "PENDENTE", prioridade: "ALTA", prazo: new Date("2026-10-10T00:00:00.000Z"),
        dataCriacao: new Date("2026-09-30T00:00:00.000Z"),
      },
      {
        id: 8, psicologoId: 83, contextoId: 80, titulo: "Tarefa de outro psicólogo", descricao: "Reservada",
        status: "PENDENTE", prioridade: "ALTA", prazo: new Date("2026-10-10T00:00:00.000Z"),
        dataCriacao: new Date("2026-09-30T00:00:00.000Z"),
      },
      {
        id: 9, psicologoId: 17, contextoId: 71, titulo: "Concluída", descricao: "",
        status: "CONCLUIDA", prioridade: "MEDIA", prazo: new Date("2026-10-11T00:00:00.000Z"),
        dataCriacao: new Date("2026-09-30T00:00:00.000Z"),
      },
      {
        id: 10, psicologoId: 17, contextoId: 70, titulo: "Em andamento", descricao: null,
        status: "EM_ANDAMENTO", prioridade: "ALTA", prazo: null,
        dataCriacao: new Date("2026-09-30T00:00:00.000Z"),
      },
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

function request(method = "GET", body, query = "") {
  return new Request(`http://localhost/api/tarefas${query}`, {
    method, headers: { "content-type": "application/json" },
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

test("schemas exigem contexto INTEGER, aceitam título até 255 e aplicam defaults somente na criação", () => {
  assert.deepEqual(createTaskSchema.parse({ titulo: " Nova ", contextoId: 70 }), {
    titulo: "Nova", contextoId: 70, status: "PENDENTE", prioridade: "MEDIA",
  });
  assert.equal(createTaskSchema.safeParse({ titulo: "T".repeat(255), contextoId: 70 }).success, true);
  assert.equal(createTaskSchema.safeParse({ titulo: "T".repeat(256), contextoId: 70 }).success, false);
  assert.equal(createTaskSchema.safeParse({ titulo: "Sem contexto" }).success, false);
  assert.deepEqual(updateTaskSchema.parse({ descricao: "Parcial" }), { descricao: "Parcial" });
  assert.deepEqual(updateTaskSchema.parse({ contextoId: 71 }), { contextoId: 71 });
  for (const contextoId of ["70", 0, -1, 1.5, 2147483648, null]) {
    assert.equal(createTaskSchema.safeParse({ titulo: "Nome", contextoId }).success, false);
    assert.equal(updateTaskSchema.safeParse({ contextoId }).success, false);
  }
});

test("schemas protegem ID, proprietário e data de criação e rejeitam PUT vazio", () => {
  for (const field of ["id", "psicologoId", "psicologo_fk", "contexto_fk", "dataCriacao", "data_criacao", "outro"]) {
    const body = { titulo: "Título", contextoId: 70, [field]: 83 };
    assert.equal(createTaskSchema.safeParse(body).success, false, field);
    assert.equal(updateTaskSchema.safeParse(body).success, false, field);
  }
  for (const body of [{}, null, [], { titulo: " " }, { descricao: null }, { prazo: null }, { titulo: undefined }]) {
    assert.equal(updateTaskSchema.safeParse(body).success, false);
  }
  const task = {
    id: 7, contextoId: 70, titulo: "Nome", status: "PENDENTE", prioridade: "MEDIA", dataCriacao: "2026-01-01",
  };
  assert.equal(taskSchema.safeParse(task).success, true);
  for (const id of ["7", 0, -1, 1.5, 2147483648]) assert.equal(taskSchema.safeParse({ ...task, id }).success, false);
  assert.equal(taskSchema.safeParse({ ...task, dataCriacao: undefined }).success, false);
});

test("datas e filtros preservam valores permitidos e rejeitam datas inexistentes", () => {
  assert.equal(createTaskSchema.parse({ titulo: "Nome", contextoId: 70, prazo: "2024-02-29" }).prazo, "2024-02-29");
  for (const prazo of ["0000-01-01", "1900-02-29", "2026-02-29", "2026-02-30", "2026-13-01", "2026-00-01", "abc", "2026-10-10T00:00:00Z"]) {
    assert.equal(createTaskSchema.safeParse({ titulo: "Nome", contextoId: 70, prazo }).success, false);
    assert.equal(updateTaskSchema.safeParse({ prazo }).success, false);
    assert.equal(taskFiltersSchema.safeParse({ prazo }).success, false);
  }
  for (const filters of [{ status: "INVALIDO" }, { prioridade: "URGENTE" }, { status: ["PENDENTE"] }]) {
    assert.equal(taskFiltersSchema.safeParse(filters).success, false);
  }
  assert.deepEqual(taskFiltersSchema.parse({ status: "PENDENTE", prioridade: "ALTA", prazo: "2026-10-10" }), {
    status: "PENDENTE", prioridade: "ALTA", prazo: "2026-10-10",
  });
});

test("IDs da URL convertem somente inteiros positivos dentro de INTEGER", () => {
  for (const [input, output] of [["1", 1], ["25", 25], ["01", 1], ["2147483647", 2147483647]]) {
    assert.equal(taskIdParamSchema.parse(input), output);
  }
  for (const input of ["", "0", "-1", "1.5", "1.0", "1e2", "+1", " 1", "1 ", "abc", "0x10", "2147483648", "999999999999999999999999", "a-b-c"]) {
    assert.equal(taskIdParamSchema.safeParse(input).success, false, input);
  }
});

test("repository lista e busca somente tarefas do proprietário, omitindo opcionais NULL", async () => {
  const repository = new PrismaTaskRepository();
  const tasks = await repository.findAll();
  assert.deepEqual(tasks.map(({ id }) => id), [7, 9, 10]);
  assert.ok(tasks.every((task) => taskSchema.safeParse(task).success));
  assert.deepEqual(await repository.findById(7), {
    id: 7, contextoId: 70, titulo: "Tarefa atual", status: "PENDENTE", prioridade: "ALTA",
    prazo: "2026-10-10", dataCriacao: "2026-09-30",
  });
  assert.equal(tasks[1].descricao, "");
  assert.equal(Object.hasOwn(tasks[2], "prazo"), false);
  assert.equal(Object.hasOwn(tasks[2], "descricao"), false);
  assert.ok(tasks.every((task) => !Object.hasOwn(task, "psicologoId")));
  assert.equal(await repository.findById(8), null);
  assert.equal(await repository.findById(999), null);
});

test("repository aplica filtros isolados/combinados no banco mantendo ownership", async () => {
  const repository = new PrismaTaskRepository();
  for (const [filters, expectedIds] of [
    [{ status: "PENDENTE" }, [7]],
    [{ prioridade: "ALTA" }, [7, 10]],
    [{ prazo: "2026-10-10" }, [7]],
    [{ status: "PENDENTE", prioridade: "ALTA", prazo: "2026-10-10" }, [7]],
    [{ status: "CONCLUIDA", prioridade: "ALTA" }, []],
    [{}, [7, 9, 10]],
  ]) {
    assert.deepEqual((await repository.findAll(filters)).map(({ id }) => id), expectedIds);
    const where = calls.findLast(({ method }) => method === "findMany").options.where;
    for (const field of Object.keys(filters)) {
      assert.deepEqual(where[field], field === "prazo" ? new Date(`${filters.prazo}T00:00:00.000Z`) : filters[field]);
    }
  }
});

test("repository define proprietário e deixa dataCriacao a cargo do banco", async () => {
  const repository = new PrismaTaskRepository();
  const created = await repository.create({
    ...createTaskSchema.parse({ titulo: "Nova", contextoId: 70, descricao: "" }),
    id: 999, psicologoId: 83, psicologo_fk: 83, dataCriacao: "1900-01-01",
  });
  assert.deepEqual(created, {
    id: 30, contextoId: 70, titulo: "Nova", descricao: "", status: "PENDENTE", prioridade: "MEDIA", dataCriacao: "2026-01-01",
  });
  assert.equal(state.records.find(({ id }) => id === created.id).psicologoId, 17);
  const checked = calls.find(({ method }) => method === "findContext");
  assert.deepEqual(checked.options.where, { id: 70, psicologoId: 17 });
});

test("repository rejeita contexto ausente/de outro proprietário antes de criar ou atualizar", async () => {
  const repository = new PrismaTaskRepository();
  const original = structuredClone(state.records);
  for (const contextoId of [80, 999]) {
    await assert.rejects(repository.create(createTaskSchema.parse({ titulo: "Indevida", contextoId })), TaskContextNotFoundError);
    await assert.rejects(repository.update(7, { contextoId }), TaskContextNotFoundError);
  }
  assert.deepEqual(state.records, original);
  assert.equal(calls.some(({ method }) => method === "create" || method === "update"), false);
});

test("repository atualiza parcialmente, permite contexto do proprietário e protege campos internos", async () => {
  const repository = new PrismaTaskRepository();
  const original = await repository.findById(7);
  assert.deepEqual(await repository.update(7, {
    titulo: "Novo", id: 999, psicologoId: 83, psicologo_fk: 83, dataCriacao: "1900-01-01",
  }), { ...original, titulo: "Novo" });
  assert.equal(calls.some(({ method }) => method === "findContext"), false);
  const changed = await repository.update(7, { contextoId: 71, descricao: "", prazo: "2024-02-29" });
  assert.deepEqual(changed, { ...original, titulo: "Novo", contextoId: 71, descricao: "", prazo: "2024-02-29" });
  assert.equal(state.records[0].psicologoId, 17);
  assert.equal(state.records[0].prazo.toISOString(), "2024-02-29T00:00:00.000Z");
  assert.equal(state.records[0].dataCriacao.toISOString(), "2026-09-30T00:00:00.000Z");
});

test("repository impede consulta, atualização e exclusão de tarefas de outro proprietário", async () => {
  const repository = new PrismaTaskRepository();
  const foreign = structuredClone(state.records[1]);
  for (const id of [8, 999]) {
    assert.equal(await repository.findById(id), null);
    assert.equal(await repository.update(id, { titulo: "Indevida" }), null);
    assert.equal(await repository.delete(id), false);
  }
  assert.deepEqual(state.records[1], foreign);
  assert.equal(await repository.delete(7), true);
  assert.equal(await repository.delete(7), false);
});

test("repository resolve proprietário em cada operação sem capturar ID fixo", async () => {
  const repository = new PrismaTaskRepository();
  await repository.findAll();
  globalThis.psicoTestSessionPsychologistId = 83;
  assert.deepEqual((await repository.findAll()).map(({ id }) => id), [8]);
  assert.equal(await repository.findById(7), null);
  assert.equal((await repository.findById(8)).id, 8);
  const created = await repository.create(createTaskSchema.parse({ titulo: "Outro", contextoId: 80 }));
  assert.equal(state.records.find(({ id }) => id === created.id).psicologoId, 83);
  assert.equal(await repository.update(7, { titulo: "Indevida" }), null);
  assert.equal((await repository.update(8, { titulo: "Permitida" })).titulo, "Permitida");
  assert.equal(await repository.delete(7), false);
  assert.equal(await repository.delete(8), true);
  assert.equal(calls.filter(({ method }) => method === "resolveOwner").length, 9);
});

test("DATE é convertido em UTC sem deslocar dia em fusos negativos ou positivos", async () => {
  const previousTimezone = process.env.TZ;
  try {
    const repository = new PrismaTaskRepository();
    for (const timezone of ["America/Fortaleza", "Pacific/Kiritimati", "UTC"]) {
      process.env.TZ = timezone;
      for (const prazo of ["0001-01-01", "0099-12-31", "2000-02-29", "2024-02-29", "9999-12-31"]) {
        const created = await repository.create(createTaskSchema.parse({ titulo: "Data", contextoId: 70, prazo }));
        assert.equal(created.prazo, prazo);
        assert.equal(created.dataCriacao, "2026-01-01");
        assert.equal(state.records.find(({ id }) => id === created.id).prazo.toISOString(), `${prazo}T00:00:00.000Z`);
      }
      assert.equal((await repository.findById(7)).prazo, "2026-10-10");
    }
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test("repository trata P2025 como ausência e FK perdida entre verificação e gravação como contexto indisponível", async () => {
  const repository = new PrismaTaskRepository();
  state.errors.update = knownError("P2025");
  assert.equal(await repository.update(7, { titulo: "Ausente" }), null);
  state.errors.create = knownError("P2003");
  await assert.rejects(repository.create(createTaskSchema.parse({ titulo: "Contexto removido", contextoId: 70 })), TaskContextNotFoundError);
  state.errors.update = knownError("P2003");
  await assert.rejects(repository.update(7, { contextoId: 71 }), TaskContextNotFoundError);
  state.errors.update = new Error("DETALHE_INTERNO_NAO_EXPOR");
  await assert.rejects(repository.update(7, { titulo: "Outro erro" }), (error) => error === state.errors.update);
});

test("service e repository em memória mantêm CRUD numérico, filtros, cópias e atualização parcial", async () => {
  const service = new TaskService(new InMemoryTaskRepository());
  const initial = await service.findAll();
  assert.ok(initial.every((task) => taskSchema.safeParse(task).success));
  const created = await service.create(createTaskSchema.parse({ titulo: "Teste", contextoId: 70, prioridade: "ALTA", prazo: "2026-10-10" }));
  assert.equal(typeof created.id, "number");
  assert.equal(taskSchema.safeParse(created).success, true);
  assert.equal(initial.some(({ id }) => id === created.id), false);
  const updated = await service.update(created.id, { descricao: "Parcial", contextoId: 71 });
  assert.deepEqual(updated, { ...created, descricao: "Parcial", contextoId: 71 });
  updated.titulo = "Mutação externa";
  assert.equal((await service.findById(created.id)).titulo, "Teste");
  const filtered = await service.findAll({ status: "PENDENTE", prioridade: "ALTA", prazo: "2026-10-10" });
  assert.ok(filtered.some(({ id }) => id === created.id));
  assert.equal(await service.delete(created.id), true);
  assert.equal(await service.findById(created.id), null);
  assert.equal(await service.update(created.id, { titulo: "Ausente" }), null);
  assert.equal(await service.delete(created.id), false);
});

test("container real utiliza Prisma no CRUD das rotas com IDs numéricos e datas públicas", async () => {
  const list = await collection.GET(request());
  assert.equal(list.status, 200);
  assert.deepEqual((await list.json()).map(({ id }) => id), [7, 9, 10]);
  const createdResponse = await collection.POST(request("POST", { titulo: " Nova ", contextoId: 70, prazo: "2024-02-29" }));
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.deepEqual(created, {
    id: 30, contextoId: 70, titulo: "Nova", status: "PENDENTE", prioridade: "MEDIA", prazo: "2024-02-29", dataCriacao: "2026-01-01",
  });
  const found = await item.GET(request(), routeContext(created.id));
  assert.equal(found.status, 200);
  assert.deepEqual(await found.json(), created);
  const renamed = await item.PUT(request("PUT", { titulo: "Renomeada" }), routeContext(created.id));
  assert.equal(renamed.status, 200);
  const moved = await item.PUT(request("PUT", { contextoId: 71 }), routeContext(created.id));
  assert.equal(moved.status, 200);
  assert.deepEqual(await moved.json(), { ...created, titulo: "Renomeada", contextoId: 71 });
  const removed = await item.DELETE(request("DELETE"), routeContext(created.id));
  assert.equal(removed.status, 204);
  assert.equal(await removed.text(), "");
  assert.equal(state.records.some(({ id }) => id === created.id), false);
});

test("GET das rotas mantém filtros isolados/combinados, resultados vazios e ausência de filtros", async () => {
  for (const [query, ids] of [
    ["", [7, 9, 10]], ["?status=PENDENTE", [7]], ["?prioridade=ALTA", [7, 10]],
    ["?prazo=2026-10-10", [7]], ["?status=PENDENTE&prioridade=ALTA&prazo=2026-10-10", [7]],
    ["?status=CONCLUIDA&prioridade=ALTA", []],
  ]) {
    const response = await collection.GET(request("GET", undefined, query));
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).map(({ id }) => id), ids);
  }
});

test("POST/PUT rejeitam payloads inválidos, campos protegidos e JSON malformado antes de consultar os dados do módulo", async () => {
  const invalid = [
    {}, null, [], { titulo: " " }, { titulo: 7 }, { titulo: "T".repeat(256) },
    { descricao: null }, { prazo: null }, { prazo: "0000-01-01" }, { prazo: "2026-02-30" }, { status: "INVALIDO" }, { prioridade: "URGENTE" },
    ...["id", "psicologoId", "psicologo_fk", "contexto_fk", "dataCriacao", "data_criacao", "outro"].map((field) => ({ [field]: 83 })),
    ...["70", 0, -1, 1.5, 2147483648].map((contextoId) => ({ contextoId })),
  ];
  for (const body of invalid) {
    const createBody = body && !Array.isArray(body) && Object.keys(body).length > 0
      ? { titulo: "Nome", contextoId: 70, ...body } : body;
    await assertInvalid(await collection.POST(request("POST", createBody)));
    await assertInvalid(await item.PUT(request("PUT", body), routeContext(7)));
  }
  await assertInvalid(await collection.POST(request("POST", { titulo: "Sem contexto" })));
  for (const method of ["POST", "PUT"]) {
    const malformed = new Request("http://localhost/api/tarefas", { method, body: "{" });
    await assertInvalid(method === "POST" ? await collection.POST(malformed) : await item.PUT(malformed, routeContext(7)));
  }
  assert.ok(calls.length > 0);
  assert.ok(calls.every(({ method }) => method === "resolveOwner"));
});

test("IDs e filtros inválidos retornam 400 antes de consultar tarefas", async () => {
  for (const id of ["0", "-1", "1.5", "abc", "1e2", "+1", "1 ", "0x10", "2147483648", "999999999999999999999999"]) {
    await assertInvalid(await item.GET(request(), routeContext(id)));
    await assertInvalid(await item.PUT(request("PUT", { titulo: "Nome" }), routeContext(id)));
    await assertInvalid(await item.DELETE(request("DELETE"), routeContext(id)));
  }
  for (const query of ["?status=INVALIDO", "?prioridade=URGENTE", "?prazo=abc", "?prazo=0000-01-01", "?prazo=2026-02-30", "?status=PENDENTE&status=CONCLUIDA", "?prioridade=", "?prazo="]) {
    await assertInvalid(await collection.GET(request("GET", undefined, query)));
  }
  assert.ok(calls.length > 0);
  assert.ok(calls.every(({ method }) => method === "resolveOwner"));
});

test("rotas retornam 404 para tarefa ausente/estrangeira e contexto ausente/estrangeiro", async () => {
  const before = structuredClone(state.records);
  for (const id of [8, 999, 2147483647]) {
    for (const response of [
      await item.GET(request(), routeContext(id)),
      await item.PUT(request("PUT", { titulo: "Indevida" }), routeContext(id)),
      await item.DELETE(request("DELETE"), routeContext(id)),
    ]) {
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: "Tarefa não encontrada" });
    }
  }
  for (const contextoId of [80, 999]) {
    for (const response of [
      await collection.POST(request("POST", { titulo: "Indevida", contextoId })),
      await item.PUT(request("PUT", { contextoId }), routeContext(7)),
    ]) {
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: "Contexto não encontrado" });
    }
  }
  assert.deepEqual(state.records, before);
});

test("todos os handlers ocultam detalhes internos em erro inesperado", async () => {
  for (const method of ["findMany", "findFirst", "create", "update", "deleteMany"]) {
    state.errors[method] = new Error("DETALHE_INTERNO_NAO_EXPOR");
  }
  for (const response of [
    await collection.GET(request()),
    await collection.POST(request("POST", { titulo: "Nova", contextoId: 70 })),
    await item.GET(request(), routeContext(7)),
    await item.PUT(request("PUT", { titulo: "Novo" }), routeContext(7)),
    await item.DELETE(request("DELETE"), routeContext(7)),
  ]) {
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "Erro interno do servidor" });
  }
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
    await item.PUT(request("PUT", { titulo: "Alteração" }), routeContext(7)),
    await item.DELETE(request("DELETE"), routeContext(7)),
  ]) {
    assert.equal(response.status, 401);
  }
  assert.ok(calls.every(({ method }) => method === "resolveOwner"));
});

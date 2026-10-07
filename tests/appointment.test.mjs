import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { createJiti } from "jiti";

// Testes isolados: não carregam .env nem abrem conexão com PostgreSQL.
const previousDatabaseUrl = process.env.DATABASE_URL;
const previousNodeEnv = process.env.NODE_ENV;
const previousPrisma = globalThis.psicoPrisma;
process.env.DATABASE_URL = "postgresql://unused.invalid/isolated_tests";
process.env.NODE_ENV = "test";

const publicFields = {
  id: true, titulo: true, descricao: true, data: true,
  horaInicio: true, horaFim: true, status: true,
};
const writableFields = ["titulo", "descricao", "data", "horaInicio", "horaFim", "status"];
const input = { titulo: "Consulta", data: "2026-10-10", horaInicio: "09:00", horaFim: "10:00" };
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
  assert.deepEqual(select, publicFields, "Somente os campos públicos devem ser selecionados.");
  return Object.fromEntries(Object.keys(select).map((key) => [key, record[key]]));
}

function matches(record, where) {
  assert.equal(typeof where.psicologoId, "number", "Toda operação deve limitar o proprietário.");
  return record.psicologoId === where.psicologoId && (where.id === undefined || record.id === where.id);
}

function assertWritable(data, creating) {
  const allowed = new Set([...writableFields, ...(creating ? ["psicologoId"] : [])]);
  assert.ok(Object.keys(data).every((key) => allowed.has(key)), "IDs e proprietário não podem ser controlados pelo payload.");
  if (data.data !== undefined) {
    assert.ok(data.data instanceof Date);
    assert.match(data.data.toISOString(), /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
  }
  for (const field of ["horaInicio", "horaFim"]) {
    if (data[field] !== undefined) {
      assert.ok(data[field] instanceof Date);
      assert.match(data[field].toISOString(), /^1970-01-01T\d{2}:\d{2}:00\.000Z$/);
    }
  }
}

globalThis.psicoPrisma = {
  psicologo: {
    async findMany(options) {
      recordCall("resolveOwner", options);
      assert.deepEqual(options, { take: 2, select: { id: true } });
      return state.ownerIds.slice(0, 2).map((id) => ({ id }));
    },
  },
  compromisso: {
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
      const record = { ...options.data, id: state.nextId++, descricao: options.data.descricao ?? null };
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

const jiti = createJiti(import.meta.url, { tsconfigPaths: true, fsCache: false });
({ Prisma } = await jiti.import("../src/generated/prisma/client.ts"));
const { appointmentSchema, createAppointmentSchema, updateAppointmentSchema, appointmentIdParamSchema } =
  await jiti.import("../src/modules/compromissos/schemas/appointment.schema.ts");
const { PrismaAppointmentRepository } = await jiti.import(
  "../src/modules/compromissos/repositories/prisma-appointment.repository.ts",
);
const { InMemoryAppointmentRepository } = await jiti.import(
  "../src/modules/compromissos/repositories/in-memory-appointment.repository.ts",
);
const { AppointmentService, INVALID_APPOINTMENT_TIME_RANGE } = await jiti.import(
  "../src/modules/compromissos/services/appointment.service.ts",
);
const collection = await jiti.import("../src/app/api/compromissos/route.ts");
const item = await jiti.import("../src/app/api/compromissos/[id]/route.ts");

beforeEach(() => {
  calls = [];
  state = {
    ownerIds: [17], nextId: 30, errors: {},
    records: [
      {
        id: 7, psicologoId: 17, titulo: "Consulta atual", descricao: null,
        data: new Date("2026-10-10T00:00:00.000Z"),
        horaInicio: new Date("1970-01-01T09:00:00.000Z"), horaFim: new Date("1970-01-01T10:00:00.000Z"),
        status: "AGENDADO",
      },
      {
        id: 8, psicologoId: 83, titulo: "Consulta de outro psicólogo", descricao: "Reservada",
        data: new Date("2026-10-10T00:00:00.000Z"),
        horaInicio: new Date("1970-01-01T11:00:00.000Z"), horaFim: new Date("1970-01-01T12:00:00.000Z"),
        status: "AGENDADO",
      },
      {
        id: 9, psicologoId: 17, titulo: "Concluído", descricao: "",
        data: new Date("2026-09-30T00:00:00.000Z"),
        horaInicio: new Date("1970-01-01T14:15:00.000Z"), horaFim: new Date("1970-01-01T15:45:00.000Z"),
        status: "CONCLUIDO",
      },
    ],
  };
});

after(() => {
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  if (previousPrisma === undefined) delete globalThis.psicoPrisma;
  else globalThis.psicoPrisma = previousPrisma;
});

function request(method = "GET", body) {
  return new Request("http://localhost/api/compromissos", {
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

test("schemas exigem ID INTEGER e título até 255, aplicando AGENDADO somente na criação", () => {
  assert.deepEqual(createAppointmentSchema.parse({ ...input, titulo: " Nova " }), {
    ...input, titulo: "Nova", status: "AGENDADO",
  });
  assert.equal(createAppointmentSchema.safeParse({ ...input, titulo: "T".repeat(255) }).success, true);
  assert.equal(createAppointmentSchema.safeParse({ ...input, titulo: "T".repeat(256) }).success, false);
  assert.deepEqual(updateAppointmentSchema.parse({ descricao: "Parcial" }), { descricao: "Parcial" });
  const appointment = { ...input, id: 7, status: "AGENDADO" };
  assert.equal(appointmentSchema.safeParse(appointment).success, true);
  for (const id of ["7", 0, -1, 1.5, 2147483648]) {
    assert.equal(appointmentSchema.safeParse({ ...appointment, id }).success, false);
  }
  for (const status of ["AGENDADO", "CONCLUIDO", "CANCELADO"]) {
    assert.equal(createAppointmentSchema.parse({ ...input, status }).status, status);
    assert.deepEqual(updateAppointmentSchema.parse({ status }), { status });
  }
});

test("schemas rejeitam campos protegidos/adicionais, valores inválidos e PUT vazio", () => {
  for (const field of ["id", "psicologoId", "psicologo_fk", "id_compromisso", "outro"]) {
    assert.equal(createAppointmentSchema.safeParse({ ...input, [field]: 83 }).success, false, field);
    assert.equal(updateAppointmentSchema.safeParse({ titulo: "Novo", [field]: 83 }).success, false, field);
  }
  for (const body of [{}, null, [], { titulo: " " }, { titulo: 1 }, { descricao: null }, { status: "INVALIDO" }, { titulo: undefined }]) {
    assert.equal(updateAppointmentSchema.safeParse(body).success, false);
  }
  for (const field of ["titulo", "data", "horaInicio", "horaFim"]) {
    assert.equal(createAppointmentSchema.safeParse({ ...input, [field]: undefined }).success, false, field);
  }
});

test("schemas validam data civil e HH:mm, incluindo limites e anos bissextos", () => {
  for (const data of ["0001-01-01", "0099-12-31", "2000-02-29", "2024-02-29", "9999-12-31"]) {
    assert.equal(createAppointmentSchema.parse({ ...input, data }).data, data);
  }
  for (const data of ["0000-01-01", "1900-02-29", "2026-02-29", "2026-02-30", "2026-13-01", "abc", "2026-10-10T00:00:00Z"]) {
    assert.equal(createAppointmentSchema.safeParse({ ...input, data }).success, false, data);
    assert.equal(updateAppointmentSchema.safeParse({ data }).success, false, data);
  }
  for (const field of ["horaInicio", "horaFim"]) {
    for (const value of ["00:00", "09:05", "23:59"]) {
      assert.equal(updateAppointmentSchema.parse({ [field]: value })[field], value);
    }
    for (const value of ["24:00", "23:60", "9:00", "09:00:00", "09:00Z", "-1:00", null, 900]) {
      assert.equal(createAppointmentSchema.safeParse({ ...input, [field]: value }).success, false);
      assert.equal(updateAppointmentSchema.safeParse({ [field]: value }).success, false);
    }
  }
});

test("IDs da URL aceitam apenas inteiros positivos no intervalo PostgreSQL INTEGER", () => {
  for (const [value, expected] of [["1", 1], ["25", 25], ["01", 1], ["2147483647", 2147483647]]) {
    assert.equal(appointmentIdParamSchema.parse(value), expected);
  }
  for (const value of ["", "0", "-1", "1.5", "1.0", "1e2", "+1", " 1", "1 ", "1\n", "abc", "0x10", "2147483648", "99999999999999999999999"]) {
    assert.equal(appointmentIdParamSchema.safeParse(value).success, false, value);
  }
});

test("repository lista e busca somente compromissos do proprietário com representação pública", async () => {
  const repository = new PrismaAppointmentRepository();
  const appointments = await repository.findAll();
  assert.deepEqual(appointments.map(({ id }) => id), [7, 9]);
  assert.ok(appointments.every((appointment) => appointmentSchema.safeParse(appointment).success));
  assert.deepEqual(await repository.findById(7), {
    id: 7, titulo: "Consulta atual", data: "2026-10-10", horaInicio: "09:00", horaFim: "10:00", status: "AGENDADO",
  });
  assert.equal(appointments[1].descricao, "");
  assert.ok(appointments.every((appointment) => !Object.hasOwn(appointment, "psicologoId")));
  assert.equal(await repository.findById(8), null);
  assert.equal(await repository.findById(999), null);
});

test("repository cria somente campos permitidos e define proprietário exclusivamente no backend", async () => {
  const repository = new PrismaAppointmentRepository();
  const created = await repository.create({
    ...createAppointmentSchema.parse({ ...input, descricao: "" }),
    id: 999, psicologoId: 83, psicologo_fk: 83, id_compromisso: 999,
  });
  assert.deepEqual(created, { ...input, id: 30, descricao: "", status: "AGENDADO" });
  assert.equal(state.records.find(({ id }) => id === created.id).psicologoId, 17);
  const data = calls.find(({ method }) => method === "create").options.data;
  assert.equal(data.data.toISOString(), "2026-10-10T00:00:00.000Z");
  assert.equal(data.horaInicio.toISOString(), "1970-01-01T09:00:00.000Z");
  assert.equal(data.horaFim.toISOString(), "1970-01-01T10:00:00.000Z");
});

test("repository preserva atualização parcial e ignora campos internos fora do contrato", async () => {
  const repository = new PrismaAppointmentRepository();
  const original = await repository.findById(7);
  assert.deepEqual(await repository.update(7, {
    titulo: "Novo", id: 999, psicologoId: 83, psicologo_fk: 83,
  }), { ...original, titulo: "Novo" });
  assert.deepEqual(await repository.update(7, { data: "2024-02-29", horaInicio: "08:45", descricao: "" }), {
    ...original, titulo: "Novo", data: "2024-02-29", horaInicio: "08:45", descricao: "",
  });
  assert.equal(state.records[0].psicologoId, 17);
  assert.equal(state.records[0].horaFim.toISOString(), "1970-01-01T10:00:00.000Z");
  assert.equal(state.records[0].data.toISOString(), "2024-02-29T00:00:00.000Z");
});

test("repository trata consulta, atualização e exclusão de recurso alheio como ausência", async () => {
  const repository = new PrismaAppointmentRepository();
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
  const repository = new PrismaAppointmentRepository();
  await repository.findAll();
  state.ownerIds = [83];
  assert.deepEqual((await repository.findAll()).map(({ id }) => id), [8]);
  assert.equal(await repository.findById(7), null);
  assert.equal((await repository.findById(8)).id, 8);
  const created = await repository.create(createAppointmentSchema.parse(input));
  assert.equal(state.records.find(({ id }) => id === created.id).psicologoId, 83);
  assert.equal(await repository.update(7, { titulo: "Indevida" }), null);
  assert.equal((await repository.update(8, { titulo: "Permitida" })).titulo, "Permitida");
  assert.equal(await repository.delete(7), false);
  assert.equal(await repository.delete(8), true);
  assert.equal(calls.filter(({ method }) => method === "resolveOwner").length, 9);
});

test("DATE e TIME preservam dia e minutos em UTC independentemente do fuso do processo", async () => {
  const previousTimezone = process.env.TZ;
  try {
    const repository = new PrismaAppointmentRepository();
    for (const timezone of ["America/Fortaleza", "Pacific/Kiritimati", "UTC"]) {
      process.env.TZ = timezone;
      for (const data of ["0001-01-01", "0099-12-31", "2000-02-29", "2024-02-29", "9999-12-31"]) {
        const created = await repository.create(createAppointmentSchema.parse({ ...input, data, horaInicio: "00:00", horaFim: "23:59" }));
        assert.equal(created.data, data);
        assert.equal(created.horaInicio, "00:00");
        assert.equal(created.horaFim, "23:59");
        assert.equal(state.records.find(({ id }) => id === created.id).data.toISOString(), `${data}T00:00:00.000Z`);
        const updated = await repository.update(created.id, { horaInicio: "00:01", horaFim: "23:58" });
        assert.equal(updated.horaInicio, "00:01");
        assert.equal(updated.horaFim, "23:58");
      }
      assert.equal((await repository.findById(7)).horaInicio, "09:00");
      assert.equal((await repository.findById(7)).data, "2026-10-10");
    }
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test("repository trata P2025 como ausência e preserva erros inesperados", async () => {
  const repository = new PrismaAppointmentRepository();
  state.errors.update = knownError("P2025");
  assert.equal(await repository.update(7, { titulo: "Removido" }), null);
  state.errors.update = new Error("DETALHE_INTERNO_NAO_EXPOR");
  await assert.rejects(repository.update(7, { titulo: "Falha" }), (error) => error === state.errors.update);
});

test("service e repository em memória mantêm IDs numéricos, CRUD, cópias e atualização parcial", async () => {
  const service = new AppointmentService(new InMemoryAppointmentRepository());
  const initial = await service.findAll();
  assert.ok(initial.every((appointment) => appointmentSchema.safeParse(appointment).success));
  const created = await service.create(createAppointmentSchema.parse(input));
  assert.equal(typeof created.id, "number");
  assert.equal(initial.some(({ id }) => id === created.id), false);
  const updated = await service.update(created.id, { descricao: "Parcial", horaInicio: "08:30" });
  assert.deepEqual(updated, { ...created, descricao: "Parcial", horaInicio: "08:30" });
  updated.titulo = "Mutação externa";
  assert.equal((await service.findById(created.id)).titulo, input.titulo);
  assert.equal(await service.delete(created.id), true);
  assert.equal(await service.findById(created.id), null);
  assert.equal(await service.update(created.id, { titulo: "Ausente" }), null);
  assert.equal(await service.delete(created.id), false);
});

test("service rejeita intervalos invertidos ou iguais inclusive em PUT de apenas um horário", async () => {
  const service = new AppointmentService(new PrismaAppointmentRepository());
  const original = structuredClone(state.records);
  const isTimeError = (error) => error.code === INVALID_APPOINTMENT_TIME_RANGE;
  for (const [horaInicio, horaFim] of [["10:00", "10:00"], ["11:00", "10:00"]]) {
    await assert.rejects(service.create(createAppointmentSchema.parse({ ...input, horaInicio, horaFim })), isTimeError);
  }
  for (const body of [{ horaInicio: "10:00" }, { horaInicio: "10:01" }, { horaFim: "09:00" }, { horaFim: "08:59" }]) {
    await assert.rejects(service.update(7, body), isTimeError);
  }
  assert.deepEqual(state.records, original);
  assert.equal(calls.some(({ method }) => method === "create" || method === "update"), false);
});

test("service persiste o par final validado ao alterar cada horário separadamente", async () => {
  const service = new AppointmentService(new PrismaAppointmentRepository());
  const first = await service.update(7, { horaInicio: "09:30" });
  assert.equal(first.horaInicio, "09:30");
  assert.equal(first.horaFim, "10:00");
  let written = calls.findLast(({ method }) => method === "update").options.data;
  assert.equal(written.horaInicio.toISOString(), "1970-01-01T09:30:00.000Z");
  assert.equal(written.horaFim.toISOString(), "1970-01-01T10:00:00.000Z");
  const second = await service.update(7, { horaFim: "10:15" });
  assert.equal(second.horaInicio, "09:30");
  assert.equal(second.horaFim, "10:15");
  written = calls.findLast(({ method }) => method === "update").options.data;
  assert.equal(written.horaInicio.toISOString(), "1970-01-01T09:30:00.000Z");
  assert.equal(written.horaFim.toISOString(), "1970-01-01T10:15:00.000Z");
});

test("container real utiliza Prisma no CRUD das rotas com IDs numéricos e datas/horas públicas", async () => {
  const list = await collection.GET();
  assert.equal(list.status, 200);
  assert.deepEqual((await list.json()).map(({ id }) => id), [7, 9]);
  const response = await collection.POST(request("POST", { ...input, titulo: " Nova " }));
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.deepEqual(created, { ...input, id: 30, titulo: "Nova", status: "AGENDADO" });
  const found = await item.GET(request(), routeContext(created.id));
  assert.equal(found.status, 200);
  assert.deepEqual(await found.json(), created);
  const renamed = await item.PUT(request("PUT", { titulo: "Renomeada" }), routeContext(created.id));
  assert.equal(renamed.status, 200);
  const dated = await item.PUT(request("PUT", { data: "2024-02-29" }), routeContext(created.id));
  assert.equal(dated.status, 200);
  assert.deepEqual(await dated.json(), { ...created, titulo: "Renomeada", data: "2024-02-29" });
  const removed = await item.DELETE(request("DELETE"), routeContext(created.id));
  assert.equal(removed.status, 204);
  assert.equal(await removed.text(), "");
  assert.equal(state.records.some(({ id }) => id === created.id), false);
});

test("rotas aceitam todos os status e preservam regra de horário após mudança de status", async () => {
  for (const status of ["CONCLUIDO", "CANCELADO", "AGENDADO"]) {
    const response = await item.PUT(request("PUT", { status }), routeContext(7));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, status);
    await assertInvalid(await item.PUT(request("PUT", { horaFim: "09:00" }), routeContext(7)));
  }
  for (const body of [{ horaInicio: "10:00" }, { horaFim: "08:59" }]) {
    await assertInvalid(await item.PUT(request("PUT", body), routeContext(7)));
  }
  await assertInvalid(await collection.POST(request("POST", { ...input, horaFim: "09:00" })));
  const valid = await item.PUT(request("PUT", { horaInicio: "08:45" }), routeContext(7));
  assert.equal(valid.status, 200);
  assert.equal((await valid.json()).horaFim, "10:00");
});

test("POST/PUT rejeitam payloads inválidos, campos protegidos e JSON malformado antes de consultar banco", async () => {
  const invalid = [
    {}, null, [], { titulo: " " }, { titulo: 7 }, { titulo: "T".repeat(256) },
    { descricao: null }, { data: null }, { data: "0000-01-01" }, { data: "2026-02-30" },
    { status: "INVALIDO" }, { horaInicio: "24:00" }, { horaFim: "10:00:00" },
    ...["id", "psicologoId", "psicologo_fk", "id_compromisso", "outro"].map((field) => ({ [field]: 83 })),
  ];
  for (const body of invalid) {
    const createBody = body && !Array.isArray(body) && Object.keys(body).length > 0 ? { ...input, ...body } : body;
    await assertInvalid(await collection.POST(request("POST", createBody)));
    await assertInvalid(await item.PUT(request("PUT", body), routeContext(7)));
  }
  for (const method of ["POST", "PUT"]) {
    const malformed = new Request("http://localhost/api/compromissos", { method, body: "{" });
    await assertInvalid(method === "POST" ? await collection.POST(malformed) : await item.PUT(malformed, routeContext(7)));
  }
  assert.equal(calls.length, 0);
});

test("IDs inválidos retornam 400 antes de consultar o banco", async () => {
  for (const id of ["0", "-1", "1.5", "1.0", "abc", "1e2", "+1", "1 ", "1\n", "0x10", "2147483648", "99999999999999999999999"]) {
    await assertInvalid(await item.GET(request(), routeContext(id)));
    await assertInvalid(await item.PUT(request("PUT", { titulo: "Novo" }), routeContext(id)));
    await assertInvalid(await item.DELETE(request("DELETE"), routeContext(id)));
  }
  assert.equal(calls.length, 0);
});

test("rotas retornam o mesmo 404 para IDs ausentes ou de outro proprietário sem alterar dados", async () => {
  const original = structuredClone(state.records);
  for (const id of [8, 999, 2147483647]) {
    for (const response of [
      await item.GET(request(), routeContext(id)),
      await item.PUT(request("PUT", { titulo: "Indevida" }), routeContext(id)),
      await item.DELETE(request("DELETE"), routeContext(id)),
    ]) {
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: "Recurso não encontrado" });
    }
  }
  assert.deepEqual(state.records, original);
});

test("todos os handlers ocultam detalhes internos em erro inesperado", async () => {
  for (const method of ["findMany", "findFirst", "create", "update", "deleteMany"]) {
    state.errors[method] = new Error("DETALHE_INTERNO_NAO_EXPOR");
  }
  for (const response of [
    await collection.GET(),
    await collection.POST(request("POST", input)),
    await item.GET(request(), routeContext(7)),
    await item.PUT(request("PUT", { titulo: "Novo" }), routeContext(7)),
    await item.DELETE(request("DELETE"), routeContext(7)),
  ]) {
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "Erro interno do servidor" });
  }
});

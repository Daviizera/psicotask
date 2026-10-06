import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { createJiti } from "jiti";

// Testes isolados: não carregam .env nem abrem conexão com o PostgreSQL.
const previousDatabaseUrl = process.env.DATABASE_URL;
const previousNodeEnv = process.env.NODE_ENV;
const previousPrisma = globalThis.psicoPrisma;
process.env.DATABASE_URL = "postgresql://unused.invalid/isolated_tests";
process.env.NODE_ENV = "test";

const publicFields = {
  id: true,
  nome: true,
  email: true,
  registroProfissional: true,
};

let state;
let calls;

function selectPublicRecord(select) {
  assert.deepEqual(select, publicFields, "A consulta deve selecionar apenas o perfil público.");
  return Object.fromEntries(Object.keys(select).map((key) => [key, state.record[key]]));
}

globalThis.psicoPrisma = {
  psicologo: {
    async findMany(options) {
      calls.push({ method: "findMany", options });
      assert.deepEqual(options, { take: 2, select: { id: true } });
      return state.ids.slice(0, 2).map((id) => ({ id }));
    },
    async findUniqueOrThrow(options) {
      calls.push({ method: "findUniqueOrThrow", options });
      if (state.readError) throw state.readError;
      assert.equal(options.where.id, state.record.id);
      return selectPublicRecord(options.select);
    },
    async update(options) {
      calls.push({ method: "update", options });
      if (state.updateError) throw state.updateError;
      assert.equal(options.where.id, state.record.id);
      for (const [key, value] of Object.entries(options.data)) {
        if (value !== undefined) state.record[key] = value;
      }
      return selectPublicRecord(options.select);
    },
  },
};

const jiti = createJiti(import.meta.url, { tsconfigPaths: true, fsCache: false });
const { Prisma } = await jiti.import("../src/generated/prisma/client.ts");
const { getCurrentPsychologistId } = await jiti.import("../src/lib/current-psychologist.ts");
const { psychologistSchema, updatePsychologistSchema } = await jiti.import(
  "../src/modules/psicologos/schemas/psychologist.schema.ts",
);
const { PrismaPsychologistRepository } = await jiti.import(
  "../src/modules/psicologos/repositories/prisma-psychologist.repository.ts",
);
const { PsychologistConflictError } = await jiti.import(
  "../src/modules/psicologos/errors/psychologist-conflict.error.ts",
);
const { InMemoryPsychologistRepository } = await jiti.import(
  "../src/modules/psicologos/repositories/in-memory-psychologist.repository.ts",
);
const { GET, PUT } = await jiti.import("../src/app/api/perfil/route.ts");

beforeEach(() => {
  process.env.NODE_ENV = "test";
  calls = [];
  state = {
    ids: [17],
    record: {
      id: 17,
      nome: "Perfil de teste",
      email: "perfil@tests.example",
      registroProfissional: "TEST-17",
      senhaHash: "HASH_PRIVADO_NAO_EXPOR",
    },
    readError: undefined,
    updateError: undefined,
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

function putRequest(body) {
  return new Request("http://localhost/api/perfil", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function uniqueConflict(field) {
  return new Prisma.PrismaClientKnownRequestError("DETALHE_INTERNO_NAO_EXPOR", {
    code: "P2002",
    clientVersion: "7.10.0",
    meta: { target: [field] },
  });
}

test("schema do perfil aceita ID inteiro positivo e mantém campos obrigatórios", () => {
  assert.equal(psychologistSchema.safeParse(state.record).success, true);
  for (const id of ["17", 0, -1, 1.5]) {
    assert.equal(psychologistSchema.safeParse({ ...state.record, id }).success, false);
  }
  for (const field of ["nome", "email", "registroProfissional"]) {
    const profile = { ...state.record };
    delete profile[field];
    assert.equal(psychologistSchema.safeParse(profile).success, false);
  }
});

test("schema de atualização aceita campos parciais e rejeita vazios, inválidos e protegidos", () => {
  assert.deepEqual(updatePsychologistSchema.parse({ nome: " Nome alterado " }), {
    nome: "Nome alterado",
  });
  for (const payload of [
    {}, null, [], { nome: "   " }, { email: "invalido" },
    { registroProfissional: " " }, { nome: 10 }, { email: null },
    { id: 17 }, { senhaHash: "hash" }, { psicologoId: 17 },
    { nome: "Nome", id: 17 }, { nome: "Nome", senhaHash: "hash" },
  ]) {
    assert.equal(updatePsychologistSchema.safeParse(payload).success, false);
  }
});

test("resolvedor exige seed quando não existe psicólogo", async () => {
  state.ids = [];
  await assert.rejects(getCurrentPsychologistId(), /seed/i);
  assert.equal(calls.length, 1);
});

test("resolvedor encontra ID não fixo sem depender de email ou registro profissional", async () => {
  state.ids = [83];
  assert.equal(await getCurrentPsychologistId(), 83);
  assert.deepEqual(calls, [{ method: "findMany", options: { take: 2, select: { id: true } } }]);
});

test("resolvedor rejeita dois ou mais psicólogos como estado ambíguo", async () => {
  state.ids = [17, 83, 99];
  await assert.rejects(getCurrentPsychologistId(), /amb[íi]guo/i);
});

test("resolvedor de desenvolvimento permanece bloqueado em produção", async () => {
  process.env.NODE_ENV = "production";
  await assert.rejects(getCurrentPsychologistId(), /produ[çc][ãa]o/i);
  assert.equal(calls.length, 0);
});

test("repository consulta somente os quatro campos públicos do psicólogo atual", async () => {
  const profile = await new PrismaPsychologistRepository().findCurrent();
  assert.deepEqual(Object.keys(profile).sort(), Object.keys(publicFields).sort());
  assert.equal(profile.id, 17);
  assert.equal(profile.registroProfissional, "TEST-17");
  assert.equal("senhaHash" in profile, false);
});

test("repository mantém atualização parcial e protege ID/hash mesmo fora do handler", async () => {
  const repository = new PrismaPsychologistRepository();
  const original = { ...state.record };
  const updated = await repository.update({ nome: "Nome atualizado", id: 999, senhaHash: "INDEVIDO" });
  const mutation = calls.find(({ method }) => method === "update").options;
  assert.equal(mutation.where.id, original.id);
  assert.equal("id" in mutation.data, false);
  assert.equal("senhaHash" in mutation.data, false);
  assert.equal(updated.nome, "Nome atualizado");
  assert.equal(updated.email, original.email);
  assert.equal(updated.registroProfissional, original.registroProfissional);
  assert.equal(state.record.id, original.id);
  assert.equal(state.record.senhaHash, original.senhaHash);
});

test("repository traduz P2002 de ambos os UNIQUEs para erro público de conflito", async () => {
  const repository = new PrismaPsychologistRepository();
  for (const field of ["email", "registro_prof"]) {
    state.updateError = uniqueConflict(field);
    await assert.rejects(repository.update({ nome: "Nome" }), (error) => {
      assert.ok(error instanceof PsychologistConflictError);
      assert.equal(error.code, "PSYCHOLOGIST_CONFLICT");
      assert.doesNotMatch(error.message, /DETALHE_INTERNO/);
      return true;
    });
  }
});

test("repository preserva erros inesperados para tratamento 500 do handler", async () => {
  const failure = new Error("DETALHE_INTERNO_NAO_EXPOR");
  state.updateError = failure;
  await assert.rejects(new PrismaPsychologistRepository().update({ nome: "Nome" }), (error) => error === failure);
});

test("GET e PUT usam o repository Prisma e continuam funcionando após edição dos identificadores", async () => {
  const initial = await GET();
  assert.equal(initial.status, 200);
  assert.equal((await initial.json()).id, 17);

  for (const payload of [
    { nome: "Novo nome" },
    { email: "novo@tests.example" },
    { registroProfissional: "TEST-NOVO" },
  ]) {
    const response = await PUT(putRequest(payload));
    assert.equal(response.status, 200);
    const updated = await response.json();
    for (const [key, value] of Object.entries(payload)) assert.equal(updated[key], value);
    const currentResponse = await GET();
    assert.equal(currentResponse.status, 200);
    assert.deepEqual(await currentResponse.json(), updated);
    assert.equal(updated.id, 17);
    assert.equal("senhaHash" in updated, false);
  }
});

test("PUT rejeita corpo vazio, inválido e campos protegidos antes de consultar banco", async () => {
  for (const payload of [
    {}, null, [], { nome: " " }, { email: "invalido" },
    { nome: "Nome", id: 18 }, { nome: "Nome", senhaHash: "INDEVIDO" },
  ]) {
    const response = await PUT(putRequest(payload));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, "Dados inválidos");
    assert.ok(Array.isArray(body.details));
  }
  const malformedResponse = await PUT(new Request("http://localhost/api/perfil", {
    method: "PUT", body: "{",
  }));
  assert.equal(malformedResponse.status, 400);
  assert.equal(calls.length, 0);
});

test("PUT converte conflito UNIQUE em 409 sem expor detalhes Prisma", async () => {
  for (const field of ["email", "registro_prof"]) {
    state.updateError = uniqueConflict(field);
    const response = await PUT(putRequest({ nome: "Nome" }));
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.deepEqual(Object.keys(body), ["error"]);
    assert.equal(typeof body.error, "string");
    assert.doesNotMatch(body.error, /DETALHE_INTERNO|P2002|senhaHash|stack/);
  }
});

test("GET e PUT ocultam detalhes dos erros inesperados em respostas 500", async () => {
  state.readError = new Error("DETALHE_INTERNO_NAO_EXPOR");
  state.updateError = new Error("DETALHE_INTERNO_NAO_EXPOR");
  for (const response of [await GET(), await PUT(putRequest({ nome: "Nome" }))]) {
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "Erro interno do servidor" });
  }
});

test("repository em memória preservado atende o contrato numérico e atualização parcial", async () => {
  const repository = new InMemoryPsychologistRepository();
  const initial = await repository.findCurrent();
  assert.equal(psychologistSchema.safeParse(initial).success, true);
  const updated = await repository.update({ nome: "Nome em memória" });
  assert.deepEqual(updated, { ...initial, nome: "Nome em memória" });
  updated.nome = "Mutação externa";
  assert.equal((await repository.findCurrent()).nome, "Nome em memória");
});

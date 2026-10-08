import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

// Executa o script real, substituindo apenas imports/ambiente. Nunca carrega .env
// nem conecta ao PostgreSQL; os valores abaixo são exclusivos dos testes.
const seedUrl = new URL("../prisma/seed.mjs", import.meta.url);
const seedSource = (await readFile(seedUrl, "utf8"))
  .replace(/^import .* from "(?:dotenv|jiti)";\r?\n/gm, "")
  .replace("import.meta.url", "seedUrl");
const developmentProfile = {
  nome: "Perfil ficticio do teste",
  email: "seed@tests.example",
  registroProfissional: "SEED-TEST-001",
};
const oldProfile = { id: 47, ...developmentProfile, senhaHash: "hash-antigo-simulado" };
const testPassword = " senha exclusiva do teste isolado ";
const simulatedHash = "hash-novo-simulado";
const databaseUrl = "postgresql://test:unused@unused.invalid/psicotask_dev_v2";

async function executeSeed({
  records = [oldProfile],
  args = [],
  environment = {},
  connectedDatabase = "psicotask_dev_v2",
  failure,
} = {}) {
  const state = structuredClone(records);
  const calls = { created: 0, updated: 0, hashed: 0, imported: 0, disconnected: 0 };
  const output = [];
  const scriptProcess = {
    argv: ["node", "prisma/seed.mjs", ...args],
    env: {
      NODE_ENV: "development",
      DATABASE_URL: databaseUrl,
      DEV_PSYCHOLOGIST_PASSWORD: testPassword,
      AUTH_SECRET: "segredo-simulado-nao-deve-ser-impresso",
      ...environment,
    },
    exitCode: undefined,
  };
  const prisma = {
    async $queryRaw() {
      if (failure) throw failure;
      return [{ database: connectedDatabase }];
    },
    async $transaction(callback, options) {
      assert.equal(options.isolationLevel, "Serializable");
      return callback({
        psicologo: {
          async findMany(query) {
            assert.equal(query.take, 2);
            assert.deepEqual(Object.keys(query.select).sort(), ["email", "id", "registroProfissional"]);
            return state.slice(0, 2).map(({ id, email, registroProfissional }) => ({
              id, email, registroProfissional,
            }));
          },
          async create(query) {
            calls.created += 1;
            assert.deepEqual(Object.keys(query.data).sort(), ["email", "nome", "registroProfissional", "senhaHash"]);
            state.push({ id: 59, ...query.data });
            return { id: 59 };
          },
          async update(query) {
            calls.updated += 1;
            assert.deepEqual(Object.keys(query.data), ["senhaHash"]);
            assert.deepEqual(Object.keys(query.where).sort(), ["email", "id", "registroProfissional"]);
            const record = state.find((candidate) => Object.entries(query.where).every(
              ([key, value]) => candidate[key] === value,
            ));
            assert.ok(record);
            Object.assign(record, query.data);
            return { id: record.id };
          },
        },
      });
    },
    async $disconnect() { calls.disconnected += 1; },
  };
  await runInNewContext(seedSource, {
    seedUrl: seedUrl.href,
    URL,
    Error,
    process: scriptProcess,
    console: {
      log: (...messages) => output.push(messages.join(" ")),
      error: (...messages) => output.push(messages.join(" ")),
    },
    config: (options) => assert.equal(options.quiet, true),
    createJiti: () => ({
      async import(path) {
        calls.imported += 1;
        if (path === "../src/lib/prisma.ts") return { prisma };
        if (path === "../src/config/development-psychologist.ts") {
          return { developmentPsychologist: developmentProfile };
        }
        if (path === "../src/lib/auth/password.ts") {
          return {
            async hashPassword(password) {
              calls.hashed += 1;
              assert.equal(password, testPassword);
              return simulatedHash;
            },
          };
        }
        assert.fail("Import inesperado pelo seed.");
      },
    }),
  }, { filename: "prisma/seed.mjs" });

  const combinedOutput = output.join("\n");
  for (const secret of [
    scriptProcess.env.DATABASE_URL,
    scriptProcess.env.DEV_PSYCHOLOGIST_PASSWORD,
    scriptProcess.env.AUTH_SECRET,
    oldProfile.senhaHash,
    simulatedHash,
  ]) {
    if (secret?.trim()) assert.equal(combinedOutput.includes(secret), false, "Saida nao pode conter segredo.");
  }
  return { records: state, calls, output: combinedOutput, exitCode: scriptProcess.exitCode ?? 0 };
}

test("seed normal preserva integralmente perfil existente, mesmo com senha de ambiente diferente", async () => {
  const result = await executeSeed({ environment: { DEV_PSYCHOLOGIST_PASSWORD: "outro-valor-ficticio" } });
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.records, [oldProfile]);
  assert.equal(result.calls.hashed, 0);
  assert.equal(result.calls.updated, 0);
});

test("seed normal com perfil existente nao exige senha nem restaura identidade personalizada", async () => {
  const personalized = { ...oldProfile, email: "personalizado@tests.example", registroProfissional: "NOVO-TESTE" };
  const result = await executeSeed({ records: [personalized], environment: { DEV_PSYCHOLOGIST_PASSWORD: undefined } });
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.records, [personalized]);
});

test("seed cria um unico perfil no banco vazio e segunda execucao nao duplica nem altera hash", async () => {
  const first = await executeSeed({ records: [] });
  assert.equal(first.exitCode, 0);
  assert.equal(first.calls.created, 1);
  assert.equal(first.calls.hashed, 1);
  assert.deepEqual(first.records, [{ id: 59, ...developmentProfile, senhaHash: simulatedHash }]);
  const second = await executeSeed({ records: first.records });
  assert.equal(second.exitCode, 0);
  assert.deepEqual(second.records, first.records);
  assert.equal(second.calls.created, 0);
  assert.equal(second.calls.updated, 0);
  assert.equal(second.calls.hashed, 0);
});

test("reset explicito atualiza somente hash e preserva ID e campos publicos", async () => {
  const existing = { ...oldProfile, nome: "Nome editado previamente" };
  const result = await executeSeed({ args: ["--reset-password"], records: [existing] });
  assert.equal(result.exitCode, 0);
  assert.equal(result.calls.created, 0);
  assert.equal(result.calls.updated, 1);
  assert.equal(result.calls.hashed, 1);
  assert.deepEqual(result.records, [{ ...existing, senhaHash: simulatedHash }]);
});

for (const args of [[], ["--reset-password"]]) {
  test(`seed ${args.length ? "reset" : "normal"} aborta quando existem multiplos perfis`, async () => {
    const records = [oldProfile, { ...oldProfile, id: 48, email: "outro@tests.example" }];
    const result = await executeSeed({ args, records });
    assert.equal(result.exitCode, 1);
    assert.deepEqual(result.records, records);
    assert.equal(result.calls.hashed, 0);
    assert.match(result.output, /estado ambíguo/);
    assert.equal(result.calls.disconnected, 1);
  });
}

test("reset recusa banco vazio sem criar perfil", async () => {
  const result = await executeSeed({ args: ["--reset-password"], records: [] });
  assert.equal(result.exitCode, 1);
  assert.equal(result.calls.created, 0);
  assert.equal(result.calls.hashed, 0);
});

for (const field of ["email", "registroProfissional"]) {
  test(`reset recusa identidade divergente em ${field}`, async () => {
    const existing = { ...oldProfile, [field]: "valor-divergente" };
    const result = await executeSeed({ args: ["--reset-password"], records: [existing] });
    assert.equal(result.exitCode, 1);
    assert.deepEqual(result.records, [existing]);
    assert.equal(result.calls.updated, 0);
    assert.equal(result.calls.hashed, 0);
  });
}

for (const [label, password] of [
  ["ausente", undefined],
  ["vazia", ""],
  ["espacos", "   "],
  ["placeholder", "defina-uma-senha-local"],
  ["muito longa", "a".repeat(1025)],
]) {
  test(`reset exige senha local valida: ${label}`, async () => {
    const result = await executeSeed({ args: ["--reset-password"], environment: { DEV_PSYCHOLOGIST_PASSWORD: password } });
    assert.equal(result.exitCode, 1);
    assert.equal(result.calls.imported, 0);
    assert.equal(result.calls.updated, 0);
  });
}

for (const environment of [
  { NODE_ENV: "production" },
  { NODE_ENV: "test" },
  { DATABASE_URL: undefined },
  { DATABASE_URL: "invalida" },
  { DATABASE_URL: "postgresql://unused.invalid/outro_database" },
  { DATABASE_URL: "postgresql://unused.invalid/psicotask_dev_v2?schema=outro" },
]) {
  test(`seed aborta antes de importar Prisma para destino invalido ${Object.keys(environment)[0]} (${Object.values(environment)[0] ?? "ausente"})`, async () => {
    const result = await executeSeed({ environment });
    assert.equal(result.exitCode, 1);
    assert.equal(result.calls.imported, 0);
  });
}

test("seed confirma nome do banco conectado antes de qualquer escrita", async () => {
  const result = await executeSeed({ connectedDatabase: "outro_database" });
  assert.equal(result.exitCode, 1);
  assert.equal(result.calls.created, 0);
  assert.equal(result.calls.updated, 0);
  assert.equal(result.calls.disconnected, 1);
});

test("seed rejeita argumentos desconhecidos", async () => {
  const result = await executeSeed({ args: ["--reset-password", "--force"] });
  assert.equal(result.exitCode, 1);
  assert.equal(result.calls.imported, 0);
});

test("erro inesperado do banco nao revela detalhes internos e desconecta", async () => {
  const result = await executeSeed({ failure: new Error(`INTERNAL ${databaseUrl} ${testPassword}`) });
  assert.equal(result.exitCode, 1);
  assert.equal(result.output.includes("INTERNAL"), false);
  assert.equal(result.calls.disconnected, 1);
});

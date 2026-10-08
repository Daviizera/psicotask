# PostgreSQL, Prisma e psicólogo de desenvolvimento

O modelo usa IDs INTEGER. A migration inicial foi revisada e aplicada ao banco
de desenvolvimento `psicotask_dev_v2`, com os quatro CHECKs. O Prisma Client foi
gerado em `src/generated/prisma`. O Perfil/Psicólogo utiliza PostgreSQL por meio
de `PrismaPsychologistRepository` e expõe ID numérico. Contextos também utiliza
PostgreSQL e IDs numéricos, por meio de `PrismaContextRepository`. Tarefas,
Compromissos e Resumo continuam usando suas implementações em memória.

## Migration inicial aplicada

- Arquivo: [migration.sql](migrations/20261006133611_init_psicotask/migration.sql).
- Destino confirmado por leitura: `psicotask_dev_v2`, exclusivamente de desenvolvimento.
- Antes da geração, o schema `public` estava vazio, sem `_prisma_migrations`.
- A aplicação foi autorizada após revisão do SQL gerado em `--create-only`.
  `_prisma_migrations` registra `20261006133611_init_psicotask` como concluída.
- Após a aplicação, a auditoria somente leitura confirmou as quatro tabelas,
  inicialmente vazias, e suas constraints. O seed descrito abaixo insere apenas
  o psicólogo de desenvolvimento.
- O SQL usa SERIAL para implementar os quatro IDs INTEGER autoincrementais e
  índices únicos para implementar as três declarações UNIQUE do schema.
- Os quatro CHECKs acrescentados manualmente ao SQL estão aplicados e validados
  no PostgreSQL. A infraestrutura não altera o schema ou o SQL dessa migration.

## Configuração preservada

- Prisma CLI, Client e adapter PostgreSQL: 7.10.0, sem preview features.
- Ambiente inspecionado: Node.js 24.19.0, Next.js 16.3.7 e TypeScript 5.9.3.
- `prisma.config.ts` carrega `.env` via dotenv e lê `DATABASE_URL`. Sem essa
  variável, a configuração permite validar o schema sem conexão ao banco.
- `.env.example` contém somente placeholders. `.env` e suas variantes continuam
  ignorados pelo Git; apenas `.env.example` é liberado.
- O generator `prisma-client` produz ESM em `src/generated/prisma`, ignorado pelo
  Git. O client já foi gerado e é usado pela infraestrutura descrita abaixo.
- `jiti` 2.7.0, já disponível na árvore de dependências, é declarado diretamente
  em `devDependencies` para o seed importar módulos TypeScript e resolver o
  alias `@/*` conforme `tsconfig.json`.
- O banco de desenvolvimento foi fornecido pelo responsável pelo projeto.
  As verificações de conexão e estrutura utilizaram transações somente leitura.

Comandos de validação local, sem alterar o banco:

```powershell
npx.cmd prisma validate
npx.cmd tsc --noEmit
npx.cmd eslint .
```

O script existente `npm.cmd run prisma:validate` também executa a validação.

## Instância central do Prisma

[src/lib/prisma.ts](../src/lib/prisma.ts) verifica a presença de `DATABASE_URL`
antes de criar `PrismaPg` e `PrismaClient`. A ausência resulta em erro claro, sem
imprimir a conexão. A instância reutilizada via `globalThis` evita multiplicar
clients e pools durante hot reload no Next.js.

O Next.js carrega as variáveis de ambiente da aplicação. O módulo não importa
`dotenv/config`; o carregamento explícito fica nos scripts Node e na configuração
da CLI. Os containers de Perfil e Contextos utilizam repositories Prisma.

## Psicólogo autenticado

[src/config/development-psychologist.ts](../src/config/development-psychologist.ts)
centraliza os valores fictícios iniciais do seed. Esses valores podem ser editados
pela API e não são usados como identidade permanente. Não há ID numérico fixo.

A função `getCurrentPsychologistId`, em
[src/lib/current-psychologist.ts](../src/lib/current-psychologist.ts), obtém o ID
da sessão validada e confirma que esse psicólogo ainda existe no PostgreSQL.
O helper `src/lib/auth/request-session.ts` lê o cookie da requisição com
`cookies()` do Next e reutiliza a verificação de assinatura HS256 e expiração.
Não há dependência da quantidade de psicólogos no banco nem cache global de ID.

Perfil, Contextos, Tarefas, Compromissos e Resumo exigem sessão. O wrapper
`withAuthentication` retorna 401 antes de validar corpo, IDs ou filtros quando
a sessão está ausente, inválida, expirada ou aponta para um perfil removido.
Respostas usam `Cache-Control: no-store`; mutações também verificam a origem.
Os repositories continuam usando o resolvedor central e seus filtros de
proprietário. Services não leem cookies ou JWT. As APIs não recebem `psicologoId`
do cliente; recursos alheios continuam sendo tratados como ausentes.

`PrismaPsychologistRepository` implementa a interface existente, usando o singleton
Prisma. Consulta e atualização selecionam somente `id`, `nome`, `email` e
`registroProfissional`; `senhaHash` não é consultado nem retornado. O mapeamento
`registroProfissional` para `registro_prof` já está definido por `@map` no schema.
O Service permanece desacoplado do armazenamento.

O PUT continua parcial e rejeita corpo vazio, inválido e campos não permitidos,
incluindo `id` e `senhaHash`. Conflitos UNIQUE (`P2002`) são traduzidos pelo
repository para um erro do módulo; a rota retorna 409 com mensagem pública.
Outros erros retornam 500 sem detalhes internos. POST e DELETE seguem sem handler.

## Contextos persistidos

`PrismaContextRepository` implementa a interface de Contextos e usa o singleton
Prisma. Todas as operações obtêm o psicólogo atual pelo resolvedor central.
Listagem e busca incluem `psicologoId` no filtro; atualização e exclusão incluem
o proprietário na própria operação de escrita, junto ao ID. Ausência ou outro
proprietário resultam em 404. O Service permanece desacoplado do armazenamento.

POST/PUT aceitam apenas `nome` e `descricao`. Campos como `id`, `psicologoId` e
`psicologo_fk` são rejeitados; o repository também seleciona explicitamente os
campos graváveis. `nome` tem limite de 200 caracteres, compatível com VARCHAR(200).
O proprietário é atribuído exclusivamente pelo backend. A resposta contém apenas
`id`, `nome` e `descricao` quando preenchida; NULL no banco mantém o campo opcional
ausente na API, enquanto texto vazio é preservado.

O ID de Contexto é number. Nas rotas dinâmicas, o texto deve conter somente dígitos
e representar um valor entre 1 e 2147483647 (PostgreSQL INTEGER). Zero, negativos,
decimais, texto e valores fora desse intervalo retornam 400. IDs válidos sem
registro acessível retornam 404. PUT permanece parcial e corpo vazio retorna 400.

O container utiliza `PrismaContextRepository`; a versão em memória permanece no
código com IDs numéricos, sem uso pelas rotas reais. DELETE preserva as FKs RESTRICT
e nenhuma constraint foi alterada. Não existe seed de Contextos.

Excluir um Contexto com Tarefas vinculadas retorna 409 com a mensagem pública
"Não é possível excluir um contexto que possui tarefas vinculadas.". O repository
traduz o erro conhecido de FK do Prisma após a tentativa de exclusão; não faz
pré-consulta nem substitui a proteção RESTRICT do PostgreSQL. IDs inexistentes
ou de outro proprietário continuam retornando 404.

Na validação HTTP, criar apenas registros temporários, conferir a propriedade e
os valores diretamente no PostgreSQL e removê-los ao final. O isolamento entre
proprietários é coberto por testes com Prisma simulado e pela suíte HTTP com
dois usuários/sessões reais. O segundo psicólogo existe apenas durante o teste.

## Seed de desenvolvimento

[seed.mjs](seed.mjs) carrega o ambiente para sua execução direta no Node e usa a
instância Prisma central. O comando é registrado em `prisma.config.ts` e pode ser
executado por:

```powershell
npm.cmd run prisma:seed
```

Esse script executa `node prisma/seed.mjs`, também registrado em `prisma.config.ts`
para `prisma db seed`. A execução exige `NODE_ENV=development` ou não definido,
o database `psicotask_dev_v2` e o schema `public`. O banco efetivamente conectado
também é conferido antes de gravar qualquer registro.

O único registro inserido é o psicólogo fictício definido na configuração
central, com nome, email e registro profissional fictícios. O seed consulta no
máximo dois psicólogos: cria somente quando não há nenhum, preserva integralmente
o registro quando há exatamente um e aborta se houver dois ou mais. Assim, editar
email ou registro profissional pela API não causa duplicação nem restaura os
valores iniciais. A verificação/criação usa uma transação Serializable; uma
concorrência incompatível aborta em vez de confirmar um segundo registro.
Não são criados Contextos, Tarefas ou Compromissos. A criação inicial exige
`DEV_PSYCHOLOGIST_PASSWORD` no `.env`, com uma senha local de até 1024 caracteres;
o placeholder de `.env.example` é rejeitado. Senhas não são aparadas nem
normalizadas antes do hash. Quando já existe um perfil, o seed normal não exige
essa variável e nunca altera seu hash, mesmo que o valor no ambiente tenha mudado.

O hash é produzido pelo `scrypt` assíncrono nativo de `node:crypto`, compartilhado
com a infraestrutura de autenticação, sem dependência adicional de hash. São
usados `N=131072`, `r=8`, `p=1`, salt aleatório de 16 bytes e chave derivada de
64 bytes. O formato existente é preservado:

```text
scrypt$131072$8$1$<salt hexadecimal>$<hash hexadecimal>
```

A senha vem exclusivamente de `DEV_PSYCHOLOGIST_PASSWORD`. Senha, hash,
`AUTH_SECRET` e `DATABASE_URL` nunca são impressos. Apenas o hash é persistido.
Um perfil criado pelo seed antigo continua com o hash original da senha
aleatória descartada até uma redefinição explicitamente solicitada.

Para definir a senha conhecida do perfil fictício existente:

```powershell
npm.cmd run prisma:seed -- --reset-password
```

Essa opção exige a variável de senha local e exatamente um psicólogo cujo email
e registro profissional ainda correspondam à configuração fictícia central.
Com zero perfis, múltiplos perfis ou identidade divergente, a operação aborta.
Somente `senhaHash` é atualizado: ID, nome, email e registro profissional são
preservados. Nenhum registro é excluído ou recriado, e o reset nunca acontece
durante um seed normal. Se email/registro foram personalizados pela API, o script
recusa o reset em vez de assumir que o usuário continua sendo o fictício.

Os testes isolados de autenticação e seed podem ser executados sem banco:

```powershell
node --test tests/auth.test.mjs tests/seed.test.mjs
```

Para testar login, sessão e logout por HTTP real, configure `AUTH_SECRET` (segredo
aleatório de pelo menos 32 bytes) e `DEV_PSYCHOLOGIST_PASSWORD` somente no `.env`
local. O perfil deve ter a senha correspondente, definida pela opção explícita
de reset acima quando necessário. Com o Next em desenvolvimento na porta 3112
(`npm.cmd run dev -- --hostname 127.0.0.1 --port 3112`), execute:

```powershell
$env:AUTH_HTTP_BASE_URL = "http://127.0.0.1:3112"
node --test tests/auth.http.test.mjs
Remove-Item Env:AUTH_HTTP_BASE_URL
```

Esse teste exige o banco de desenvolvimento com um psicólogo e as outras três
tabelas vazias, consulta o Prisma real e não altera perfil, hash ou dados. Sem
`AUTH_HTTP_BASE_URL`, ele é ignorado na suíte comum. Os CRUDs existentes exigem
sessão, e o teste confirma 401 sem cookie e acesso com a sessão autenticada.

Para a regressão com dois usuários, execute as suítes HTTP sequencialmente:

```powershell
$env:AUTH_HTTP_BASE_URL = "http://127.0.0.1:3112"
node --test --test-concurrency=1 tests/auth.http.test.mjs tests/ownership.http.test.mjs
Remove-Item Env:AUTH_HTTP_BASE_URL
```

A suíte de ownership cria um segundo perfil e dados temporários, testa ambos os
proprietários e remove somente seus registros de teste em `finally`. Ao terminar,
confere um psicólogo, zero registros nas outras três tabelas e preservação do
perfil de desenvolvimento e seu hash. Não executar essas suítes em paralelo,
pois ambas verificam o mesmo estado inicial do banco.

Para validar a integração, registrar o perfil atual, testar GET/PUT por HTTP e
conferir as alterações diretamente no PostgreSQL. Executar o seed também após
editar email/registro, restaurar o perfil original ao terminar e conferir um
único psicólogo e zero registros nas outras três tabelas.

Os testes isolados de Perfil e Contextos usam Prisma simulado, sem acessar o banco:

```powershell
node --test tests/psychologist.test.mjs
node --test tests/context.test.mjs
```

## Tabelas e campos físicos

Os nomes físicos são singulares, em minúsculas e snake_case. `@map` e `@@map`
mantêm nomes idiomáticos no Prisma, como `id`, `psicologoId`, `contextoId`,
`registroProfissional`, `dataCriacao`, `horaInicio` e `horaFim`.
Todos os campos são NOT NULL, exceto os marcados como opcionais abaixo.
As propriedades de relação Prisma não criam colunas adicionais.

### psicologo

| Campo físico | Tipo PostgreSQL | Restrições/default |
| --- | --- | --- |
| id_psicologo | integer | PK; autoincrement |
| nome | varchar(200) | Obrigatório |
| email | varchar(254) | Obrigatório; UNIQUE |
| senha_hash | varchar(255) | Obrigatório; sem default; somente hash |
| registro_prof | varchar(50) | Obrigatório; UNIQUE |

### contexto

| Campo físico | Tipo PostgreSQL | Restrições/default |
| --- | --- | --- |
| id_contexto | integer | PK; autoincrement |
| psicologo_fk | integer | Obrigatório; FK psicologo(id_psicologo) |
| nome | varchar(200) | Obrigatório |
| descricao | text | Opcional (NULL) |

UNIQUE adicional: `(id_contexto, psicologo_fk)`.

### tarefa

| Campo físico | Tipo PostgreSQL | Restrições/default |
| --- | --- | --- |
| id_tarefa | integer | PK; autoincrement |
| psicologo_fk | integer | Obrigatório; FK psicologo(id_psicologo); parte da FK composta |
| contexto_fk | integer | Obrigatório; parte da FK composta para contexto |
| titulo | varchar(255) | Obrigatório |
| descricao | text | Opcional (NULL) |
| status | varchar(20) | Obrigatório; DEFAULT 'PENDENTE'; CHECK |
| prioridade | varchar(10) | Obrigatório; DEFAULT 'MEDIA'; CHECK |
| prazo | date | Opcional (NULL) |
| data_criacao | date | Obrigatório; DEFAULT CURRENT_DATE |

`dataCriacao` usa `DateTime @db.Date @default(dbgenerated("CURRENT_DATE"))`.
O tipo físico é DATE, sem componente de horário. CURRENT_DATE é avaliado pelo
PostgreSQL conforme a data da transação e o fuso da sessão do banco; na integração,
o fuso operacional deve ser configurado explicitamente.

### compromisso

| Campo físico | Tipo PostgreSQL | Restrições/default |
| --- | --- | --- |
| id_compromisso | integer | PK; autoincrement |
| psicologo_fk | integer | Obrigatório; FK psicologo(id_psicologo) |
| titulo | varchar(255) | Obrigatório |
| descricao | text | Opcional (NULL) |
| data | date | Obrigatório |
| hora_inicio | time without time zone | Obrigatório |
| hora_fim | time without time zone | Obrigatório |
| status | varchar(20) | Obrigatório; DEFAULT 'AGENDADO'; CHECK |

`horaInicio` e `horaFim` usam `@db.Time`, com a precisão padrão do tipo nativo
(até seis casas de segundos fracionários). A API atual continua usando HH:mm.

## Comprimentos VARCHAR

| Uso | Comprimento | Motivo da escolha física |
| --- | --- | --- |
| Nomes de psicólogo/contexto | 200 | Espaço para nomes completos e rótulos descritivos |
| Títulos de tarefa/compromisso | 255 | Espaço para títulos descritivos |
| Email | 254 | Capacidade usual para um endereço completo |
| Hash de senha | 255 | Espaço para formatos de hash codificados com seus parâmetros |
| Registro profissional | 50 | Espaço para número, região, categoria e separadores |
| Status | 20 | Comporta todos os valores autorizados |
| Prioridade | 10 | Comporta BAIXA, MEDIA e ALTA |

Esses comprimentos são limites de armazenamento. O schema Zod de Contexto já valida
o limite de 200 caracteres do nome. Os demais limites ainda precisarão de tratamento
nos respectivos módulos. Descrições permanecem TEXT, sem limite adicional declarado.
Foram preservados os defaults existentes PENDENTE, MEDIA e AGENDADO.
Não há enums PostgreSQL: status e prioridade são String/VARCHAR.

## PKs, UNIQUEs e relações

- PKs individuais autoincrementais: psicologo(id_psicologo), contexto(id_contexto),
  tarefa(id_tarefa) e compromisso(id_compromisso), todas representadas por
  `Int @id @default(autoincrement())`.
- UNIQUEs: psicologo(email), psicologo(registro_prof) e
  contexto(id_contexto, psicologo_fk).
- Relações 1:N: Psicologo–Contexto, Psicologo–Tarefa, Psicologo–Compromisso e
  Contexto–Tarefa. Não existe relação Tarefa–Compromisso ou Contexto–Compromisso.
- Todas as FKs usam ON DELETE RESTRICT e ON UPDATE RESTRICT. Um contexto em uso
  não pode ser excluído, nem ter o proprietário alterado por cascata.
- Índices de suporte às FKs: contexto(psicologo_fk), tarefa(psicologo_fk),
  tarefa(contexto_fk, psicologo_fk) e compromisso(psicologo_fk).

A propriedade do contexto é garantida pela FK composta:

```prisma
// Em Contexto:
@@unique([id, psicologoId])

// Em Tarefa:
contexto Contexto @relation(fields: [contextoId, psicologoId], references: [id, psicologoId], onDelete: Restrict, onUpdate: Restrict)
```

Pelos mapeamentos físicos, isso corresponde a:
`tarefa(contexto_fk, psicologo_fk) -> contexto(id_contexto, psicologo_fk)`.
Uma tarefa do psicólogo A não pode referenciar um contexto do psicólogo B, pois o
par não existe na tabela referenciada. Os dois campos NOT NULL impedem contornar
a FK com NULL. A regra abrange INSERT e UPDATE, inclusive fora do Prisma, sem
necessidade de trigger. A FK direta Tarefa–Psicologo também permanece declarada.

## CHECKs aplicados pela primeira migration

O schema Prisma 7 não representa CHECKs. **Formatar/validar o schema não cria nem
verifica estas restrições no PostgreSQL.** Os quatro CHECKs abaixo foram incluídos
manualmente ao final da migration inicial e estão aplicados e validados no banco
de desenvolvimento alvo.

```sql
ALTER TABLE "tarefa"
  ADD CONSTRAINT "tarefa_status_check"
    CHECK ("status" IN ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA')),
  ADD CONSTRAINT "tarefa_prioridade_check"
    CHECK ("prioridade" IN ('BAIXA', 'MEDIA', 'ALTA'));

ALTER TABLE "compromisso"
  ADD CONSTRAINT "compromisso_status_check"
    CHECK ("status" IN ('AGENDADO', 'CONCLUIDO', 'CANCELADO')),
  ADD CONSTRAINT "compromisso_hora_fim_maior_inicio_check"
    CHECK ("hora_fim" > "hora_inicio");
```

String/VARCHAR e seus defaults não restringem os valores permitidos sozinhos.
As colunas envolvidas são NOT NULL. Horário final igual ou anterior ao inicial
é rejeitado; compromissos atravessando a meia-noite não são aceitos por essa
regra. O seed não reaplica a migration nem altera essas restrições.

## Adaptações futuras do backend, não implementadas

- Perfil/Psicólogo e Contextos já usam ID number. Tarefas e Compromissos continuam
  com IDs string; sua integração precisará validar/converter os parâmetros HTTP.
- Contexto já recebe `psicologoId` exclusivamente do backend. Tarefa e Compromisso
  ainda precisarão dessa integração; Tarefa também precisará de `contextoId`.
  A FK garante consistência e não substitui autorização.
- `dataCriacao` deve ser preenchida pelo banco e excluída dos payloads de criação
  e atualização aceitos do cliente.
- `senhaHash` é obrigatória e não tem default. O seed usa hash real da senha local
  informada por ambiente; perfis antigos só têm o hash alterado mediante
  `--reset-password`, conforme descrito acima. A futura criação de contas ainda
  precisará definir seu fluxo de credenciais. A implementação de Perfil em
  memória permanece disponível, mas seu container utiliza o repository Prisma.
  O hash nunca deve fazer parte da resposta pública de Perfil.
- Prisma representa DATE/TIME por DateTime (Date no client). Os repositories
  futuros precisarão mapear AAAA-MM-DD e HH:mm sem deslocamento indevido de datas,
  além de converter NULL para a representação de opcionais dos contratos atuais.
- UNIQUEs, FKs, CHECKs e limites VARCHAR exigirão tratamento de erros na integração.
  Regras de texto não vazio e email válido continuam nos schemas Zod existentes.

## Referências

- [Configuração do Prisma 7](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference)
- [Suporte a CHECK no Prisma 7](https://www.prisma.io/docs/orm/v7/reference/database-features)
- [Constraints PostgreSQL](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [Tipos de data/hora PostgreSQL](https://www.postgresql.org/docs/current/datatype-datetime.html)

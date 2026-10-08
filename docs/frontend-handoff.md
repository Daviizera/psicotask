# PsicoTask — handoff do backend para Galvão

Este documento descreve a API atual para integrar o frontend na mesma aplicação
Next.js. Perfil, Contextos, Tarefas e Compromissos persistem no PostgreSQL. Resumo
consulta os mesmos Services e não mantém uma segunda fonte de dados.

## Visão geral

- Next.js 16.3.7 com Route Handlers, TypeScript e validação Zod.
- Prisma 7.10.0 com PostgreSQL; Repository Pattern e Service Layer.
- Fluxo: Route Handler → schema Zod → Service → interface de Repository →
  Repository Prisma → PostgreSQL.
- Autenticação por JWT assinado, armazenado em cookie HttpOnly. Todas as APIs de
  domínio exigem sessão e consultam somente os dados do psicólogo autenticado.
- As implementações em memória ainda existem para testes; os containers reais
  utilizam Prisma. Não há endpoint de cadastro, recuperação de senha ou refresh.

## Setup local

Use Node.js compatível com os pacotes instalados: o Prisma exige
`^20.19 || ^22.12 || >=24.0`, e o Next exige `>=20.9.0`. O projeto foi validado
com Node.js 24.19.0. É necessário PostgreSQL local acessível e permissões para
executar as migrations de desenvolvimento, incluindo o shadow database usado
por `prisma migrate dev`.

No PowerShell:

```powershell
git clone https://github.com/Daviizera/psicotask.git
cd psicotask
npm.cmd install
Copy-Item .env.example .env
```

Crie um banco local **vazio** chamado `psicotask_dev_v2`, com schema `public`,
usando sua instalação PostgreSQL. Configure o `.env` copiado antes dos próximos
comandos. Se já existir um `.env` local, preserve-o em vez de sobrescrevê-lo.

| Variável | Uso e configuração local |
| --- | --- |
| `DATABASE_URL` | Conexão PostgreSQL do servidor. Informe usuário, senha, host e porta reais da sua instalação e o banco `psicotask_dev_v2`, com `?schema=public`. O exemplo atualmente usa `/psicotask`; ajuste esse nome no seu `.env`. |
| `AUTH_SECRET` | Segredo aleatório de pelo menos 32 bytes para assinar/verificar a sessão. Substitua o placeholder; nunca exponha ao navegador. |
| `DEV_PSYCHOLOGIST_PASSWORD` | Senha local usada pelo seed para criar o perfil fictício e pelo reset explícito. Deve ter de 1 a 1024 caracteres, não ser composta somente por espaços nem ser o placeholder. |

O `.env` fica ignorado pelo Git. Não prefixe essas variáveis com `NEXT_PUBLIC_`.
O arquivo `.env.example` contém placeholders, não uma configuração pronta para
conectar ou autenticar. Caracteres reservados da senha da conexão precisam estar
codificados corretamente na URL.

Com o banco e o ambiente configurados:

```powershell
npx.cmd prisma migrate dev
npx.cmd prisma generate
npm.cmd run prisma:seed
npm.cmd run dev
```

`prisma migrate dev` aplica a migration versionada. O `prisma generate` é
explícito: Prisma 7 não o executa automaticamente nesse fluxo. O Client gerado
em `src/generated/prisma` é ignorado pelo Git e precisa existir no clone local.
Não use reset ou `db push` para contornar conflito com um banco já populado;
confira o destino se a CLI indicar drift ou solicitar reset.

Acesse `http://localhost:3000`. Use o mesmo host durante login e demais chamadas;
`localhost` e `127.0.0.1` não compartilham cookies.

### Perfil fictício e senha de desenvolvimento

O seed aceita apenas `psicotask_dev_v2/public`, com `NODE_ENV` ausente ou igual a
`development`. Cria somente um psicólogo quando o banco não tem nenhum; com
exatamente um, preserva todos os seus campos e hash. Com mais de um, aborta.
Não cria Contextos, Tarefas ou Compromissos.

Os valores iniciais são fictícios e ficam em
[`src/config/development-psychologist.ts`](../src/config/development-psychologist.ts).
O email inicial para login é `psicologo.dev@psicotask.example`; a senha é a que
você definiu em `DEV_PSYCHOLOGIST_PASSWORD`, nunca um valor versionado. Se o email
foi editado no Perfil, use o email atual no login.

Alterar a variável local e executar o seed normal **não redefine** uma senha já
persistida. Quando for necessário definir a senha conhecida do perfil fictício
existente, execute explicitamente:

```powershell
npm.cmd run prisma:seed -- --reset-password
```

O reset exige a variável de senha e exatamente um perfil, cujo email e registro
profissional correspondam à configuração fictícia. Atualiza apenas `senha_hash`;
preserva ID, nome, email e registro profissional, sem excluir ou recriar o
usuário. Identidade divergente ou estado ambíguo abortam a operação.

O hash usa `scrypt` assíncrono de `node:crypto`, no formato
`scrypt$131072$8$1$<salt hexadecimal>$<hash hexadecimal>`. O login verifica o hash
com `timingSafeEqual`. Senha e hash nunca são campos de resposta da API.

## Autenticação no frontend

1. Envie `POST /api/auth/login` com JSON `{ "email": "...", "senha": "..." }`.
2. Em `200`, o corpo contém o Perfil público e o navegador armazena o cookie.
3. Consulte `GET /api/auth/me` ao restaurar o estado de autenticação da interface.
4. Trate `401` como sessão ausente, inválida ou expirada e solicite novo login.
5. Para sair, envie `POST /api/auth/logout`; em `204`, limpe o estado local da
   interface. Uma consulta posterior a `/me` retorna `401`.

O cookie `psicotask_session` tem `HttpOnly`, `SameSite=Lax`, `Path=/` e duração de
8 horas (`Max-Age=28800`). Em produção também tem `Secure` e requer HTTPS. O JWT
usa exclusivamente HS256 e contém `psicologoId`, `iat` e `exp`, sem email, senha
ou hash. Não há renovação automática. Logout remove o cookie; esta versão não
mantém tabela de sessões nem revogação centralizada de tokens já emitidos.

O JavaScript do navegador não lê o cookie HttpOnly. Não copie o JWT para estado
React, header `Authorization` ou `localStorage`: a API usa o cookie. Chamadas
`fetch` para a própria aplicação enviam cookies automaticamente. Prefira URLs
relativas e mantenha frontend e API na mesma origem; mutações com origem externa
são rejeitadas com `403`, e não há contrato de integração CORS para outro host.
Cookies da requisição do navegador não são repassados automaticamente por um
`fetch` executado no servidor.

Exemplo no navegador, com valores vindos do formulário:

```typescript
const response = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "same-origin",
  body: JSON.stringify({ email, senha }),
});
const body = await response.json();
if (!response.ok) {
  // Exiba body.error; não registre a senha nem o corpo enviado ao login.
} else {
  // body contém somente o perfil público. O cookie é administrado pelo navegador.
}
```

Payload de exemplo (substitua a senha pelo valor local, sem versioná-lo):

```json
{
  "email": "psicologo.dev@psicotask.example",
  "senha": "<senha-local-do-formulario>"
}
```

Resposta `200` de login, `/api/auth/me` e `/api/perfil` (ID ilustrativo):

```json
{
  "id": 1,
  "nome": "Marina Exemplo (Desenvolvimento)",
  "email": "psicologo.dev@psicotask.example",
  "registroProfissional": "DEV-FICTICIO-0001"
}
```

Não fixe `id = 1` no frontend. Use os IDs retornados pela API. Email inexistente
e senha incorreta têm a mesma resposta: `401` com
`{"error":"E-mail ou senha inválidos"}`.

## Contratos de entrada e saída

Os corpos são objetos JSON, sem envelope `data`. Listagens retornam arrays, e
`204` não tem corpo: não chame `response.json()` nesse status. Envie
`Content-Type: application/json` nos POST/PUT com corpo; login exige esse header.

IDs são números inteiros positivos de até `2147483647`. Na URL, `:id` deve
conter somente dígitos e respeitar esse intervalo. Decimais, zero, negativos,
texto e valores fora do intervalo retornam `400`.

Schemas de escrita são estritos: campos extras retornam `400`. Todos os PUTs
são parciais, mas `{}` é inválido. Campo omitido no PUT preserva o valor atual.
`descricao` e `prazo` opcionais **não aceitam `null`**. Quando não preenchidos,
são omitidos da resposta; descrição `""` é aceita. Ainda não existe operação
para remover um prazo previamente definido; omiti-lo não o limpa.

### Perfil

`Perfil` é o objeto público com `id`, `nome`, `email` e `registroProfissional`.
PUT aceita somente os três últimos campos, em qualquer subconjunto não vazio.
Nome e registro não podem ficar vazios; email deve ser válido. Nome e registro
são aparados (`trim`). ID, senha e hash não são editáveis por essa API.
Email e registro profissional são únicos entre psicólogos.

Os limites físicos são nome 200, email 254 e registro 50 caracteres. O schema
Zod de Perfil ainda não valida esses máximos; o frontend deve respeitá-los, sem
depender de uma resposta `400` para excessos. Não há POST/DELETE de Perfil.

### Contexto

- POST exige `nome` (texto não vazio, aparado, até 200 caracteres).
- `descricao` é texto opcional; PUT aceita `nome` e/ou `descricao`.
- Resposta `Contexto`: `{ "id": 25, "nome": "Estudo", "descricao": "Leituras" }`.
- Não existe UNIQUE de nome: dois Contextos podem ter o mesmo nome.
- Excluir um Contexto com Tarefas vinculadas retorna `409`, mantendo ambos.
  Remova ou transfira as Tarefas para outro Contexto próprio antes de excluir.

### Tarefa

| Campo | Entrada e resposta |
| --- | --- |
| `id` | Somente resposta; número gerado pelo banco. |
| `contextoId` | Obrigatório no POST; número de um Contexto do usuário autenticado. Pode mudar no PUT para outro Contexto próprio. |
| `titulo` | Obrigatório no POST; texto aparado, não vazio, até 255 caracteres. |
| `descricao` | Texto opcional. |
| `status` | `PENDENTE`, `EM_ANDAMENTO` ou `CONCLUIDA`; default `PENDENTE` no POST. |
| `prioridade` | `BAIXA`, `MEDIA` ou `ALTA`; default `MEDIA` no POST. |
| `prazo` | Data civil válida `YYYY-MM-DD`, opcional, ano de 0001 a 9999. |
| `dataCriacao` | Somente resposta; `YYYY-MM-DD`, gerada pelo banco com `CURRENT_DATE`. |

POST mínimo: `{ "titulo": "Revisar planejamento", "contextoId": 25 }`.
Exemplo de resposta `Tarefa` quando também foi informado `prazo`:

```json
{
  "id": 31,
  "contextoId": 25,
  "titulo": "Revisar planejamento",
  "status": "PENDENTE",
  "prioridade": "MEDIA",
  "prazo": "2026-10-20",
  "dataCriacao": "2026-10-08"
}
```

Para editar, envie apenas o que mudou, por exemplo `{ "status": "CONCLUIDA" }`.
Não envie `id`, `psicologoId`, `psicologo_fk` ou `dataCriacao`. Contexto inexistente
ou de outro usuário retorna `404` com `{"error":"Contexto não encontrado"}`.

Filtros RF06 de `GET /api/tarefas`:

```text
/api/tarefas
/api/tarefas?status=PENDENTE
/api/tarefas?prioridade=ALTA
/api/tarefas?prazo=2026-10-20
/api/tarefas?status=PENDENTE&prioridade=ALTA&prazo=2026-10-20
```

Sem filtros, retorna todas as Tarefas do usuário. Filtros combinados usam **E**;
prazo é uma igualdade de data, não um intervalo. Valores inválidos, vazios ou
repetição de um filtro retornam `400`. Não há filtros por Contexto, busca textual,
ordenação ou paginação. Parâmetros desconhecidos são ignorados, nunca usados
para selecionar proprietário. Não dependa de ordem nas listagens de CRUDs.

### Compromisso

- POST exige `titulo` (aparado, não vazio, até 255 caracteres), `data`,
  `horaInicio` e `horaFim`.
- `descricao` é texto opcional.
- `status`: `AGENDADO`, `CONCLUIDO` ou `CANCELADO`; default `AGENDADO` no POST.
- `data`: data civil válida `YYYY-MM-DD`, ano de 0001 a 9999.
- Horas: `HH:mm`, em 24 horas, sem segundos, offset ou timezone.
- `horaFim` deve ser maior que `horaInicio`, no mesmo dia. Intervalos iguais,
  invertidos ou atravessando a meia-noite não são aceitos.
- PUT parcial valida o intervalo final combinado com os horários persistidos.
  Alterar só `horaInicio` pode gerar `400` se superar `horaFim` existente.

POST de exemplo:

```json
{
  "titulo": "Supervisão",
  "data": "2026-10-20",
  "horaInicio": "09:00",
  "horaFim": "10:00"
}
```

Resposta `Compromisso`: os campos enviados, mais `id` numérico e
`status: "AGENDADO"` quando omitido. Não possui `contextoId` nem vínculo com
Tarefa. Preserve datas e horas como strings civis na interface; não converta
`YYYY-MM-DD` automaticamente em um instante que possa mudar de dia pelo fuso.

### Resumo

Retorna exatamente estes três campos:

```json
{
  "tarefasPendentes": 0,
  "tarefasPrioritarias": 0,
  "proximosCompromissos": []
}
```

- `tarefasPendentes`: quantidade com status `PENDENTE`.
- `tarefasPrioritarias`: prioridade `ALTA` e status diferente de `CONCLUIDA`.
- `proximosCompromissos`: até **5** objetos completos `Compromisso`, com status
  `AGENDADO` e data igual ou posterior ao dia atual em `America/Fortaleza`,
  ordenados por data e depois por `horaInicio`, crescentes.
- Compromissos de hoje entram mesmo que o horário já tenha passado; o corte é
  pela data. Passados, `CANCELADO` e `CONCLUIDO` ficam fora.
- Com nenhum dado do usuário, retorna os zeros e array vazio acima.

Não há total geral, contagem de `EM_ANDAMENTO`/`CONCLUIDA` ou parâmetro HTTP de
data de referência nesse endpoint. A referência opcional existe somente no
Service para testes. Todos os valores são calculados com dados do usuário da
sessão, pelos Services de Tarefas e Compromissos.

## Endpoints disponíveis

Nas tabelas, `Perfil`, `Contexto`, `Tarefa`, `Compromisso` e `Resumo` são os
objetos descritos acima; `[]` indica array. Todos podem responder `500` em falha
inesperada, com mensagem genérica. Endpoints autenticados também respondem `401`
antes de validar IDs, filtros ou corpos quando a sessão não é válida. Mutações
podem retornar `403` se a origem for rejeitada.

| Método e URL | Finalidade | Sessão | Payload / parâmetros | Sucesso | Principais erros |
| --- | --- | --- | --- | --- | --- |
| `POST /api/auth/login` | Iniciar sessão | Não | `{ email, senha }` | `200 Perfil` + cookie | `400` JSON/schema; `401` credenciais; `403` origem; `500` |
| `GET /api/auth/me` | Consultar usuário da sessão | Sim | Sem corpo | `200 Perfil` | `401`; `500` |
| `POST /api/auth/logout` | Remover cookie | Não exige sessão válida | Sem corpo | `204` | `403` origem |
| `GET /api/perfil` | Consultar perfil | Sim | Sem corpo | `200 Perfil` | `401`; `500` |
| `PUT /api/perfil` | Editar dados profissionais | Sim | Parte não vazia de `{ nome, email, registroProfissional }` | `200 Perfil` | `400`; `401`; `403`; `409` email/registro duplicado; `500` |
| `GET /api/contextos` | Listar Contextos próprios | Sim | Sem corpo | `200 Contexto[]` | `401`; `500` |
| `POST /api/contextos` | Criar Contexto | Sim | `{ nome, descricao? }` | `201 Contexto` | `400`; `401`; `403`; `500` |
| `GET /api/contextos/:id` | Consultar Contexto próprio | Sim | ID na URL; sem corpo | `200 Contexto` | `400` ID; `401`; `404`; `500` |
| `PUT /api/contextos/:id` | Editar Contexto próprio | Sim | ID + parte não vazia de `{ nome, descricao }` | `200 Contexto` | `400`; `401`; `403`; `404`; `500` |
| `DELETE /api/contextos/:id` | Excluir Contexto próprio | Sim | ID; sem corpo | `204` | `400`; `401`; `403`; `404`; `409` Tarefas vinculadas; `500` |
| `GET /api/tarefas` | Listar/filtrar Tarefas próprias | Sim | Query opcional `status`, `prioridade`, `prazo`; sem corpo | `200 Tarefa[]` | `400` filtros; `401`; `500` |
| `POST /api/tarefas` | Criar Tarefa | Sim | `{ titulo, contextoId, descricao?, status?, prioridade?, prazo? }` | `201 Tarefa` | `400`; `401`; `403`; `404` Contexto; `500` |
| `GET /api/tarefas/:id` | Consultar Tarefa própria | Sim | ID; sem corpo | `200 Tarefa` | `400`; `401`; `404`; `500` |
| `PUT /api/tarefas/:id` | Editar Tarefa própria | Sim | ID + subconjunto não vazio dos campos do POST | `200 Tarefa` | `400`; `401`; `403`; `404` Tarefa/Contexto; `500` |
| `DELETE /api/tarefas/:id` | Excluir Tarefa própria | Sim | ID; sem corpo | `204` | `400`; `401`; `403`; `404`; `500` |
| `GET /api/compromissos` | Listar Compromissos próprios | Sim | Sem corpo | `200 Compromisso[]` | `401`; `500` |
| `POST /api/compromissos` | Criar Compromisso | Sim | `{ titulo, data, horaInicio, horaFim, descricao?, status? }` | `201 Compromisso` | `400` incluindo horário; `401`; `403`; `500` |
| `GET /api/compromissos/:id` | Consultar Compromisso próprio | Sim | ID; sem corpo | `200 Compromisso` | `400`; `401`; `404`; `500` |
| `PUT /api/compromissos/:id` | Editar Compromisso próprio | Sim | ID + subconjunto não vazio dos campos do POST | `200 Compromisso` | `400` incluindo horário final combinado; `401`; `403`; `404`; `500` |
| `DELETE /api/compromissos/:id` | Excluir Compromisso próprio | Sim | ID; sem corpo | `204` | `400`; `401`; `403`; `404`; `500` |
| `GET /api/resumo` | Consultar visão consolidada | Sim | Sem corpo | `200 Resumo` | `401`; `500` |

`?` na coluna de payload indica campo opcional, não faz parte do nome do campo.
Não envie corpo em GET/DELETE/logout. O logout não precisa de um token válido
para remover o cookie local.

## Respostas de erro e comportamento da interface

| Status | Significado e tratamento |
| --- | --- |
| `200 OK` | Consulta/atualização/login concluído; use o JSON retornado. |
| `201 Created` | Recurso criado; use o ID e os defaults retornados. |
| `204 No Content` | Exclusão/logout concluído; não tente interpretar JSON. |
| `400 Bad Request` | JSON, campos, ID, filtros ou horário inválidos. Exiba `error` e use `details` para associar problemas a campos. |
| `401 Unauthorized` | Credenciais inválidas no login ou sessão ausente/inválida/expirada nas APIs protegidas; um perfil removido também invalida o acesso. |
| `403 Forbidden` | Origem não permitida em mutação. Faça chamadas na mesma origem da aplicação. |
| `404 Not Found` | Recurso inexistente ou de outro usuário; não tente distinguir esses casos. Também cobre Contexto inválido para uma Tarefa. |
| `409 Conflict` | Conflito de email/registro profissional único ou exclusão de Contexto com Tarefas. Exiba a mensagem e preserve o item na interface. |
| `500 Internal Server Error` | Falha inesperada/configuração; mensagem pública genérica, sem SQL, constraint, stack ou detalhes do Prisma. |

Exemplo de validação:

```json
{
  "error": "Dados inválidos",
  "details": [
    { "path": ["nome"], "message": "O nome não pode ficar vazio." }
  ]
}
```

`details` contém `path` (array de segmentos do campo; `[]` para erro do corpo) e
`message`. Nem todos os erros possuem `details`. Mensagens por status/recurso:

| Caso | Corpo JSON |
| --- | --- |
| Sessão inválida/ausente | `{ "error": "Não autenticado" }` |
| Login incorreto | `{ "error": "E-mail ou senha inválidos" }` |
| Contexto/Compromisso não encontrado | `{ "error": "Recurso não encontrado" }` |
| Tarefa não encontrada | `{ "error": "Tarefa não encontrada" }` |
| Contexto inválido no vínculo da Tarefa | `{ "error": "Contexto não encontrado" }` |
| Perfil com email/registro duplicado | `{ "error": "E-mail ou registro profissional já cadastrado." }` |
| Excluir Contexto com Tarefas | `{ "error": "Não é possível excluir um contexto que possui tarefas vinculadas." }` |
| Falha inesperada | `{ "error": "Erro interno do servidor" }` |

O banco continua impondo `RESTRICT`; o backend traduz o conflito conhecido em
`409` sem apagar Contexto ou Tarefas. Uma tentativa de exclusão de Contexto
alheio retorna `404`, mesmo que esse Contexto tenha Tarefas.

## Ownership e responsabilidades do frontend

A identidade vem da sessão da requisição. O backend confirma que o psicólogo
existe e aplica o proprietário em leituras e escritas. A FK composta também
impede Tarefa ligada a Contexto de outro psicólogo. O frontend seleciona apenas
`contextoId` entre os Contextos retornados para a sessão atual.

- Não envie `psicologoId`, `psicologo_fk` ou outro identificador de proprietário.
- Não manipule JWT nem armazene token em `localStorage`.
- Não use IDs conhecidos de outro usuário para controlar ownership.
- Não envie o objeto completo da resposta em PUT; monte apenas campos editáveis.
- Não dependa de detalhes internos/erros do Prisma ou nomes físicos das tabelas.
- Não acesse PostgreSQL diretamente nem importe Prisma em componentes do cliente.
- Ao sair ou receber `401`, limpe os dados de usuário mantidos pela interface.
  As respostas autenticadas usam `Cache-Control: no-store`.

## Arquivos importantes

| Caminho | Papel |
| --- | --- |
| [`src/app/api/`](../src/app/api/) | Route Handlers, métodos HTTP, validação de entrada e respostas públicas. |
| [`src/modules/`](../src/modules/) | Types, schemas, Services, interfaces/implementações de Repositories e containers. |
| [`src/lib/auth/`](../src/lib/auth/) | Sessão JWT/cookie, scrypt, leitura por requisição e proteção das rotas/origem. |
| [`src/lib/prisma.ts`](../src/lib/prisma.ts) | Singleton Prisma com adapter PostgreSQL e conexão exclusiva do servidor. |
| [`src/lib/current-psychologist.ts`](../src/lib/current-psychologist.ts) | Resolve a identidade autenticada e confirma sua existência; não assume um único usuário. |
| [`prisma/schema.prisma`](../prisma/schema.prisma) | Modelo persistente, mapeamentos de campos e relações. |
| [`prisma/migrations/`](../prisma/migrations/) | SQL versionado, incluindo CHECKs e FKs RESTRICT. |
| [`prisma/seed.mjs`](../prisma/seed.mjs) | Criação idempotente do perfil fictício e reset explícito da senha em desenvolvimento. |
| [`.env.example`](../.env.example) | Nomes das variáveis e placeholders para configuração local. |
| [`tests/`](../tests/) | Testes de schemas, Services, Repositories, autenticação e integração HTTP/ownership. |

## Verificação local

```powershell
npx.cmd tsc --noEmit
npx.cmd eslint .
npx.cmd prisma validate
npx.cmd prisma migrate status
node --test tests/*.test.mjs
```

Sem `AUTH_HTTP_BASE_URL`, as suítes HTTP são ignoradas. Para executá-las,
inicie o Next em um terminal:

```powershell
npm.cmd run dev -- --hostname 127.0.0.1 --port 3112
```

Em outro terminal, na raiz do projeto:

```powershell
$env:AUTH_HTTP_BASE_URL = "http://127.0.0.1:3112"
node --test --test-concurrency=1 tests/auth.http.test.mjs tests/ownership.http.test.mjs
Remove-Item Env:AUTH_HTTP_BASE_URL
```

Essas suítes usam PostgreSQL real e exigem um perfil de desenvolvimento com a
senha local correspondente, e zero Contextos, Tarefas e Compromissos no início.
Ownership cria um segundo perfil e registros temporários e os remove ao final,
preservando o perfil original e seu hash. Execute-as sequencialmente, conforme
o comando, em banco de desenvolvimento dedicado.

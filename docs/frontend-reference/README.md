# Referências visuais do frontend — PsicoTask

Esta pasta reúne materiais utilizados como referência visual para a nova etapa de desenvolvimento do frontend do PsicoTask.

Os arquivos aqui presentes **não definem o escopo funcional da aplicação**.

## Arquivos

### `reference.html`

Implementação visual utilizada como referência para:

- estrutura geral do dashboard;
- sidebar;
- header;
- organização do workspace;
- cards;
- Kanban;
- filtros;
- chips e badges;
- botões;
- inputs;
- drawers e modais;
- estados de hover e foco;
- densidade visual;
- responsividade;
- padrões de interação.

O arquivo contém dados e funcionalidades demonstrativas que não necessariamente pertencem ao PsicoTask.

### `DESIGN.md`

Documento utilizado como referência para:

- paleta de cores;
- tipografia;
- espaçamentos;
- raios de borda;
- elevação e sombras;
- componentes;
- hierarquia visual;
- estados de interação;
- organização geral das interfaces.

O documento também contém terminologia clínica e exemplos que ultrapassam o escopo atual do produto. Esses elementos não devem ser interpretados como requisitos funcionais.

## Hierarquia das fontes

Em caso de dúvida ou conflito, considerar a seguinte ordem de autoridade:

1. requisitos e escopo atuais documentados no dossiê do PsicoTask;
2. regras de negócio e arquitetura existentes no projeto;
3. `docs/frontend-handoff.md`, para contratos da API e integração com o backend;
4. `CLAUDE.md`, para regras obrigatórias de desenvolvimento;
5. `DESIGN.md`, exclusivamente para identidade e padrões visuais;
6. `reference.html`, como referência concreta de composição e interação visual.

Uma referência visual nunca deve substituir um requisito funcional nem justificar uma alteração no backend.

## Escopo atual do PsicoTask

A versão atual permanece concentrada na organização da rotina profissional do psicólogo.

As principais áreas funcionais são:

- autenticação;
- perfil profissional;
- contextos;
- tarefas;
- acompanhamento do status das tarefas;
- compromissos;
- organização e consulta da rotina;
- resumo da rotina.

## Funcionalidades fora do escopo atual

Elementos existentes nos arquivos de referência relacionados às seguintes funcionalidades devem ser ignorados funcionalmente:

- pacientes;
- prontuários;
- registros ou conteúdo de sessões;
- CID;
- anamnese;
- diagnósticos;
- avaliações psicológicas;
- documentos psicológicos;
- escalas ou questionários clínicos;
- decisões terapêuticas;
- informações clínicas de pacientes;
- qualquer outra funcionalidade clínica não prevista nos requisitos atuais.

Esses termos podem existir nos arquivos originais somente porque eles fazem parte da referência visual utilizada na concepção da interface.

Eles não devem ser implementados.

Caso alguma dessas funcionalidades seja considerada futuramente, ela deverá passar por nova análise de escopo, requisitos, modelagem, segurança, privacidade e backend antes de entrar no produto.

## Regra de adaptação

Ao utilizar os arquivos desta pasta:

**preservar o padrão visual, mas adaptar o conteúdo ao domínio atual do PsicoTask.**

Exemplos:

- `Prontuários` não deve resultar na criação de um módulo de prontuários;
- `Perfil Clínico` deve ser adaptado para o perfil profissional existente;
- referências a pacientes devem ser substituídas por informações compatíveis com tarefas, contextos ou compromissos;
- ações denominadas `Demanda Clínica` devem ser adaptadas para ações existentes, como `Nova Tarefa`;
- exemplos de busca por CID, prontuários ou pacientes não devem ser reproduzidos.

## Identidade visual

A nova interface deverá manter consistência entre as telas.

A referência atual utiliza principalmente:

- Plus Jakarta Sans;
- azul profundo para navegação e ações principais;
- superfícies claras azuladas;
- cards brancos;
- bordas suaves;
- sombras discretas;
- cantos arredondados;
- badges e chips semânticos;
- cores contextuais para diferenciar categorias e prioridades;
- alta legibilidade e baixa poluição visual.

O `DESIGN.md` deverá ser consultado para os tokens e regras detalhadas.

## Desenvolvimento

O novo frontend é desenvolvido na branch:

`frontend-davi`

Cada tela deve ser implementada de forma incremental.

Antes de iniciar uma tela, o desenvolvedor ou agente deverá:

1. identificar o requisito correspondente;
2. verificar o contrato disponível no backend;
3. analisar os arquivos desta pasta como referência visual;
4. adaptar a referência ao escopo real;
5. implementar sem modificar o backend para acomodar decisões puramente visuais.

Se a interface parecer exigir uma funcionalidade que não esteja disponível no escopo ou na API atual, a implementação deve ser interrompida para análise antes de qualquer alteração estrutural.
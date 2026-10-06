-- CreateTable
CREATE TABLE "psicologo" (
    "id_psicologo" SERIAL NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "registro_prof" VARCHAR(50) NOT NULL,

    CONSTRAINT "psicologo_pkey" PRIMARY KEY ("id_psicologo")
);

-- CreateTable
CREATE TABLE "contexto" (
    "id_contexto" SERIAL NOT NULL,
    "psicologo_fk" INTEGER NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "descricao" TEXT,

    CONSTRAINT "contexto_pkey" PRIMARY KEY ("id_contexto")
);

-- CreateTable
CREATE TABLE "tarefa" (
    "id_tarefa" SERIAL NOT NULL,
    "psicologo_fk" INTEGER NOT NULL,
    "contexto_fk" INTEGER NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    "prazo" DATE,
    "prioridade" VARCHAR(10) NOT NULL DEFAULT 'MEDIA',
    "data_criacao" DATE NOT NULL DEFAULT CURRENT_DATE,

    CONSTRAINT "tarefa_pkey" PRIMARY KEY ("id_tarefa")
);

-- CreateTable
CREATE TABLE "compromisso" (
    "id_compromisso" SERIAL NOT NULL,
    "psicologo_fk" INTEGER NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "data" DATE NOT NULL,
    "hora_inicio" TIME NOT NULL,
    "hora_fim" TIME NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'AGENDADO',

    CONSTRAINT "compromisso_pkey" PRIMARY KEY ("id_compromisso")
);

-- CreateIndex
CREATE UNIQUE INDEX "psicologo_email_key" ON "psicologo"("email");

-- CreateIndex
CREATE UNIQUE INDEX "psicologo_registro_prof_key" ON "psicologo"("registro_prof");

-- CreateIndex
CREATE INDEX "contexto_psicologo_fk_idx" ON "contexto"("psicologo_fk");

-- CreateIndex
CREATE UNIQUE INDEX "contexto_id_contexto_psicologo_fk_key" ON "contexto"("id_contexto", "psicologo_fk");

-- CreateIndex
CREATE INDEX "tarefa_psicologo_fk_idx" ON "tarefa"("psicologo_fk");

-- CreateIndex
CREATE INDEX "tarefa_contexto_fk_psicologo_fk_idx" ON "tarefa"("contexto_fk", "psicologo_fk");

-- CreateIndex
CREATE INDEX "compromisso_psicologo_fk_idx" ON "compromisso"("psicologo_fk");

-- AddForeignKey
ALTER TABLE "contexto" ADD CONSTRAINT "contexto_psicologo_fk_fkey" FOREIGN KEY ("psicologo_fk") REFERENCES "psicologo"("id_psicologo") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "tarefa" ADD CONSTRAINT "tarefa_psicologo_fk_fkey" FOREIGN KEY ("psicologo_fk") REFERENCES "psicologo"("id_psicologo") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "tarefa" ADD CONSTRAINT "tarefa_contexto_fk_psicologo_fk_fkey" FOREIGN KEY ("contexto_fk", "psicologo_fk") REFERENCES "contexto"("id_contexto", "psicologo_fk") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "compromisso" ADD CONSTRAINT "compromisso_psicologo_fk_fkey" FOREIGN KEY ("psicologo_fk") REFERENCES "psicologo"("id_psicologo") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- CHECKs adicionados manualmente: nao representados no schema Prisma 7.
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

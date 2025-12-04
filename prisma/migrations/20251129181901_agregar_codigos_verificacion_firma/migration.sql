-- CreateTable
CREATE TABLE "codigos_verificacion_firma" (
    "id_codigo" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_tramite" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "codigo" VARCHAR(6) NOT NULL,
    "email_destinatario" VARCHAR(150) NOT NULL,
    "expira_en" TIMESTAMP NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_usado" TIMESTAMP,
    "intentos_fallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_hasta" TIMESTAMP,
    "ip_solicitud" VARCHAR(45),
    "user_agent" VARCHAR(255),
    "fecha_creacion" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_verificacion_firma_pkey" PRIMARY KEY ("id_codigo")
);

-- CreateIndex
CREATE INDEX "codigos_verificacion_firma_id_tramite_usado_expira_en_idx" ON "codigos_verificacion_firma"("id_tramite", "usado", "expira_en");

-- CreateIndex
CREATE INDEX "codigos_verificacion_firma_id_usuario_bloqueado_hasta_idx" ON "codigos_verificacion_firma"("id_usuario", "bloqueado_hasta");

-- AddForeignKey
ALTER TABLE "codigos_verificacion_firma" ADD CONSTRAINT "codigos_verificacion_firma_id_tramite_fkey" FOREIGN KEY ("id_tramite") REFERENCES "tramite"("id_tramite") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_verificacion_firma" ADD CONSTRAINT "codigos_verificacion_firma_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

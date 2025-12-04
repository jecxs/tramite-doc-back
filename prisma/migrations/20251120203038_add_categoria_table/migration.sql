-- CreateTable
CREATE TABLE "respuesta_tramite" (
    "id_respuesta" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_tramite" UUID NOT NULL,
    "texto_respuesta" TEXT NOT NULL,
    "esta_conforme" BOOLEAN NOT NULL DEFAULT true,
    "fecha_respuesta" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),
    "navegador" VARCHAR(100),
    "dispositivo" VARCHAR(100),

    CONSTRAINT "respuesta_tramite_pkey" PRIMARY KEY ("id_respuesta")
);

-- CreateIndex
CREATE UNIQUE INDEX "respuesta_tramite_id_tramite_key" ON "respuesta_tramite"("id_tramite");

-- AddForeignKey
ALTER TABLE "respuesta_tramite" ADD CONSTRAINT "respuesta_tramite_id_tramite_fkey" FOREIGN KEY ("id_tramite") REFERENCES "tramite"("id_tramite") ON DELETE CASCADE ON UPDATE CASCADE;

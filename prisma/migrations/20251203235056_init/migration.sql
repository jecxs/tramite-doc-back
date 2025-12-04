-- CreateTable
CREATE TABLE "area" (
    "id_area" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(100) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "area_pkey" PRIMARY KEY ("id_area")
);

-- CreateTable
CREATE TABLE "rol" (
    "id_rol" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id_rol")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id_usuario" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dni" VARCHAR(20) NOT NULL,
    "nombres" VARCHAR(100) NOT NULL,
    "apellidos" VARCHAR(100) NOT NULL,
    "correo" VARCHAR(150) NOT NULL,
    "telefono" VARCHAR(20),
    "password" VARCHAR(255) NOT NULL,
    "id_area" UUID NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id_usuario")
);

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

-- CreateTable
CREATE TABLE "usuario_rol" (
    "id_usuario" UUID NOT NULL,
    "id_rol" UUID NOT NULL,

    CONSTRAINT "usuario_rol_pkey" PRIMARY KEY ("id_usuario","id_rol")
);

-- CreateTable
CREATE TABLE "tipo_documento" (
    "id_tipo" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    "requiere_firma" BOOLEAN NOT NULL DEFAULT false,
    "requiere_respuesta" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tipo_documento_pkey" PRIMARY KEY ("id_tipo")
);

-- CreateTable
CREATE TABLE "documento" (
    "id_documento" UUID NOT NULL DEFAULT gen_random_uuid(),
    "titulo" VARCHAR(255) NOT NULL,
    "ruta_archivo" VARCHAR(500) NOT NULL,
    "nombre_archivo" VARCHAR(255) NOT NULL,
    "extension" VARCHAR(10) NOT NULL,
    "tamano_bytes" BIGINT NOT NULL,
    "id_tipo" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "id_documento_anterior" UUID,
    "fecha_creacion" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por" UUID NOT NULL,

    CONSTRAINT "documento_pkey" PRIMARY KEY ("id_documento")
);

-- CreateTable
CREATE TABLE "tramite" (
    "id_tramite" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" VARCHAR(50) NOT NULL,
    "id_documento" UUID NOT NULL,
    "id_remitente" UUID NOT NULL,
    "id_area_remitente" UUID NOT NULL,
    "id_receptor" UUID NOT NULL,
    "asunto" VARCHAR(255) NOT NULL,
    "mensaje" TEXT,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'ENVIADO',
    "requiere_firma" BOOLEAN NOT NULL DEFAULT false,
    "requiere_respuesta" BOOLEAN NOT NULL DEFAULT false,
    "fecha_envio" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_abierto" TIMESTAMP,
    "fecha_leido" TIMESTAMP,
    "fecha_firmado" TIMESTAMP,
    "fecha_anulado" TIMESTAMP,
    "es_reenvio" BOOLEAN NOT NULL DEFAULT false,
    "id_tramite_original" UUID,
    "motivo_reenvio" TEXT,
    "numero_version" INTEGER NOT NULL DEFAULT 1,
    "anulado_por" UUID,
    "motivo_anulacion" TEXT,

    CONSTRAINT "tramite_pkey" PRIMARY KEY ("id_tramite")
);

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

-- CreateTable
CREATE TABLE "historial_tramite" (
    "id_historial" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_tramite" UUID NOT NULL,
    "accion" VARCHAR(50) NOT NULL,
    "detalle" TEXT,
    "estado_anterior" VARCHAR(20),
    "estado_nuevo" VARCHAR(20),
    "datos_adicionales" JSONB,
    "realizado_por" UUID,
    "ip_address" VARCHAR(45),
    "fecha" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_tramite_pkey" PRIMARY KEY ("id_historial")
);

-- CreateTable
CREATE TABLE "firma_electronica" (
    "id_firma" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_tramite" UUID NOT NULL,
    "acepta_terminos" BOOLEAN NOT NULL,
    "ip_address" VARCHAR(45) NOT NULL,
    "navegador" VARCHAR(100),
    "dispositivo" VARCHAR(100),
    "fecha_firma" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "firma_electronica_pkey" PRIMARY KEY ("id_firma")
);

-- CreateTable
CREATE TABLE "observacion" (
    "id_observacion" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_tramite" UUID NOT NULL,
    "creado_por" UUID NOT NULL,
    "tipo" VARCHAR(30) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fecha_creacion" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resuelta" BOOLEAN NOT NULL DEFAULT false,
    "fecha_resolucion" TIMESTAMP,
    "resuelto_por" UUID,
    "respuesta" TEXT,

    CONSTRAINT "observacion_pkey" PRIMARY KEY ("id_observacion")
);

-- CreateTable
CREATE TABLE "notificacion" (
    "id_notificacion" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_usuario" UUID NOT NULL,
    "id_tramite" UUID,
    "tipo" VARCHAR(30) NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "mensaje" TEXT NOT NULL,
    "visto" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_visto" TIMESTAMP,

    CONSTRAINT "notificacion_pkey" PRIMARY KEY ("id_notificacion")
);

-- CreateIndex
CREATE UNIQUE INDEX "area_nombre_key" ON "area"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "rol_codigo_key" ON "rol"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "rol_nombre_key" ON "rol"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_dni_key" ON "usuario"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_correo_key" ON "usuario"("correo");

-- CreateIndex
CREATE INDEX "usuario_id_area_idx" ON "usuario"("id_area");

-- CreateIndex
CREATE INDEX "usuario_correo_idx" ON "usuario"("correo");

-- CreateIndex
CREATE INDEX "codigos_verificacion_firma_id_tramite_usado_expira_en_idx" ON "codigos_verificacion_firma"("id_tramite", "usado", "expira_en");

-- CreateIndex
CREATE INDEX "codigos_verificacion_firma_id_usuario_bloqueado_hasta_idx" ON "codigos_verificacion_firma"("id_usuario", "bloqueado_hasta");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_documento_codigo_key" ON "tipo_documento"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_documento_nombre_key" ON "tipo_documento"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "tramite_codigo_key" ON "tramite"("codigo");

-- CreateIndex
CREATE INDEX "tramite_id_receptor_idx" ON "tramite"("id_receptor");

-- CreateIndex
CREATE INDEX "tramite_id_remitente_idx" ON "tramite"("id_remitente");

-- CreateIndex
CREATE INDEX "tramite_estado_idx" ON "tramite"("estado");

-- CreateIndex
CREATE INDEX "tramite_fecha_envio_idx" ON "tramite"("fecha_envio");

-- CreateIndex
CREATE UNIQUE INDEX "respuesta_tramite_id_tramite_key" ON "respuesta_tramite"("id_tramite");

-- CreateIndex
CREATE INDEX "historial_tramite_id_tramite_idx" ON "historial_tramite"("id_tramite");

-- CreateIndex
CREATE UNIQUE INDEX "firma_electronica_id_tramite_key" ON "firma_electronica"("id_tramite");

-- CreateIndex
CREATE INDEX "observacion_id_tramite_idx" ON "observacion"("id_tramite");

-- CreateIndex
CREATE INDEX "notificacion_id_usuario_idx" ON "notificacion"("id_usuario");

-- CreateIndex
CREATE INDEX "notificacion_visto_idx" ON "notificacion"("visto");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_id_area_fkey" FOREIGN KEY ("id_area") REFERENCES "area"("id_area") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_verificacion_firma" ADD CONSTRAINT "codigos_verificacion_firma_id_tramite_fkey" FOREIGN KEY ("id_tramite") REFERENCES "tramite"("id_tramite") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_verificacion_firma" ADD CONSTRAINT "codigos_verificacion_firma_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "rol"("id_rol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_id_tipo_fkey" FOREIGN KEY ("id_tipo") REFERENCES "tipo_documento"("id_tipo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_id_documento_anterior_fkey" FOREIGN KEY ("id_documento_anterior") REFERENCES "documento"("id_documento") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tramite" ADD CONSTRAINT "tramite_id_documento_fkey" FOREIGN KEY ("id_documento") REFERENCES "documento"("id_documento") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tramite" ADD CONSTRAINT "tramite_id_remitente_fkey" FOREIGN KEY ("id_remitente") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tramite" ADD CONSTRAINT "tramite_id_area_remitente_fkey" FOREIGN KEY ("id_area_remitente") REFERENCES "area"("id_area") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tramite" ADD CONSTRAINT "tramite_id_receptor_fkey" FOREIGN KEY ("id_receptor") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tramite" ADD CONSTRAINT "tramite_id_tramite_original_fkey" FOREIGN KEY ("id_tramite_original") REFERENCES "tramite"("id_tramite") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tramite" ADD CONSTRAINT "tramite_anulado_por_fkey" FOREIGN KEY ("anulado_por") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuesta_tramite" ADD CONSTRAINT "respuesta_tramite_id_tramite_fkey" FOREIGN KEY ("id_tramite") REFERENCES "tramite"("id_tramite") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_tramite" ADD CONSTRAINT "historial_tramite_id_tramite_fkey" FOREIGN KEY ("id_tramite") REFERENCES "tramite"("id_tramite") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_tramite" ADD CONSTRAINT "historial_tramite_realizado_por_fkey" FOREIGN KEY ("realizado_por") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "firma_electronica" ADD CONSTRAINT "firma_electronica_id_tramite_fkey" FOREIGN KEY ("id_tramite") REFERENCES "tramite"("id_tramite") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observacion" ADD CONSTRAINT "observacion_id_tramite_fkey" FOREIGN KEY ("id_tramite") REFERENCES "tramite"("id_tramite") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observacion" ADD CONSTRAINT "observacion_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observacion" ADD CONSTRAINT "observacion_resuelto_por_fkey" FOREIGN KEY ("resuelto_por") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_id_tramite_fkey" FOREIGN KEY ("id_tramite") REFERENCES "tramite"("id_tramite") ON DELETE CASCADE ON UPDATE CASCADE;

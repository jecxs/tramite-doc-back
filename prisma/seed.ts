import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { ERoles } from 'src/common/enums/ERoles.enum';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');

  const tablesOk = await Promise.all([
    prisma.area
      .count()
      .then(() => true)
      .catch(() => false),
    prisma.rol
      .count()
      .then(() => true)
      .catch(() => false),
    prisma.usuario
      .count()
      .then(() => true)
      .catch(() => false),
    prisma.usuarioRol
      .count()
      .then(() => true)
      .catch(() => false),
    prisma.tipoDocumento
      .count()
      .then(() => true)
      .catch(() => false),
  ]);
  if (!tablesOk.every(Boolean)) {
    throw new Error(
      'Tablas requeridas no existen. Ejecutar migraciones antes del seed.',
    );
  }

  const already = await prisma.usuario.count({
    where: { correo: 'admin@universidad.edu' },
  });
  if (already > 0) {
    console.log('Seed ya aplicado, sin cambios');
    return;
  }

  const areaRRHH = await prisma.area.upsert({
    where: { nombre: 'Recursos Humanos' },
    update: {},
    create: { nombre: 'Recursos Humanos' },
  });

  const areaTI = await prisma.area.upsert({
    where: { nombre: 'Tecnologías de la Información' },
    update: {},
    create: { nombre: 'Tecnologías de la Información' },
  });

  console.log('Áreas creadas');

  const rolAdmin = await prisma.rol.upsert({
    where: { codigo: ERoles.ADMIN },
    update: { nombre: 'Administrador' },
    create: { codigo: ERoles.ADMIN, nombre: 'Administrador' },
  });

  const rolResponsable = await prisma.rol.upsert({
    where: { codigo: ERoles.RESP },
    update: { nombre: 'Responsable de Área' },
    create: { codigo: ERoles.RESP, nombre: 'Responsable de Área' },
  });

  const rolTrabajador = await prisma.rol.upsert({
    where: { codigo: ERoles.TRAB },
    update: { nombre: 'Trabajador' },
    create: { codigo: ERoles.TRAB, nombre: 'Trabajador' },
  });

  console.log('Roles creados');

  // 3. Crear Usuarios
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.usuario.upsert({
    where: { correo: 'admin@universidad.edu' },
    update: { password: passwordHash, id_area: areaRRHH.id_area },
    create: {
      dni: '12345678',
      nombres: 'Juan',
      apellidos: 'Pérez Admin',
      correo: 'admin@universidad.edu',
      password: passwordHash,
      id_area: areaRRHH.id_area,
    },
  });

  await prisma.usuarioRol.upsert({
    where: {
      id_usuario_id_rol: {
        id_usuario: admin.id_usuario,
        id_rol: rolAdmin.id_rol,
      },
    },
    update: {},
    create: { id_usuario: admin.id_usuario, id_rol: rolAdmin.id_rol },
  });

  const responsable = await prisma.usuario.upsert({
    where: { correo: 'maria.garcia@universidad.edu' },
    update: { password: passwordHash, id_area: areaRRHH.id_area },
    create: {
      dni: '87654321',
      nombres: 'María',
      apellidos: 'García',
      correo: 'maria.garcia@universidad.edu',
      password: passwordHash,
      id_area: areaRRHH.id_area,
    },
  });

  await prisma.usuarioRol.upsert({
    where: {
      id_usuario_id_rol: {
        id_usuario: responsable.id_usuario,
        id_rol: rolResponsable.id_rol,
      },
    },
    update: {},
    create: {
      id_usuario: responsable.id_usuario,
      id_rol: rolResponsable.id_rol,
    },
  });

  const trabajador = await prisma.usuario.upsert({
    where: { correo: 'carlos.lopez@universidad.edu' },
    update: { password: passwordHash, id_area: areaTI.id_area },
    create: {
      dni: '11223344',
      nombres: 'Carlos',
      apellidos: 'López',
      correo: 'carlos.lopez@universidad.edu',
      password: passwordHash,
      id_area: areaTI.id_area,
    },
  });

  await prisma.usuarioRol.upsert({
    where: {
      id_usuario_id_rol: {
        id_usuario: trabajador.id_usuario,
        id_rol: rolTrabajador.id_rol,
      },
    },
    update: {},
    create: { id_usuario: trabajador.id_usuario, id_rol: rolTrabajador.id_rol },
  });

  console.log('Usuarios creados');

  // 4. Crear Tipos de Documento
  await prisma.tipoDocumento.createMany({
    data: [
      {
        codigo: 'CONTRATO',
        nombre: 'Contrato Laboral',
        descripcion: 'Contrato de trabajo',
        requiere_firma: true,
        requiere_respuesta: false,
      },
      {
        codigo: 'MEMO',
        nombre: 'Memorándum',
        descripcion: 'Documento informativo',
        requiere_firma: false,
        requiere_respuesta: false,
      },
      {
        codigo: 'NOTIF',
        nombre: 'Notificación',
        descripcion: 'Notificación oficial',
        requiere_firma: false,
        requiere_respuesta: true,
      },
    ],
    skipDuplicates: true,
  });

  console.log('Tipos de documento creados');
  console.log('Seed completado exitosamente');
}

main()
  .catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

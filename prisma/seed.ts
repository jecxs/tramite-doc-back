import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');

  // 1. Crear Áreas
  const areaRRHH = await prisma.area.create({
    data: {
      nombre: 'Recursos Humanos',
    },
  });

  const areaTI = await prisma.area.create({
    data: {
      nombre: 'Tecnologías de la Información',
    },
  });

  console.log('Áreas creadas');

  // 2. Crear Roles
  const rolAdmin = await prisma.rol.create({
    data: {
      codigo: 'ADMIN',
      nombre: 'Administrador',
    },
  });

  const rolResponsable = await prisma.rol.create({
    data: {
      codigo: 'RESP',
      nombre: 'Responsable de Área',
    },
  });

  const rolTrabajador = await prisma.rol.create({
    data: {
      codigo: 'TRAB',
      nombre: 'Trabajador',
    },
  });

  console.log('Roles creados');

  // 3. Crear Usuarios
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.usuario.create({
    data: {
      dni: '12345678',
      nombres: 'Juan',
      apellidos: 'Pérez Admin',
      correo: 'admin@universidad.edu',
      password: passwordHash,
      id_area: areaRRHH.id_area,
    },
  });

  await prisma.usuarioRol.create({
    data: {
      id_usuario: admin.id_usuario,
      id_rol: rolAdmin.id_rol,
    },
  });

  const responsable = await prisma.usuario.create({
    data: {
      dni: '87654321',
      nombres: 'María',
      apellidos: 'García',
      correo: 'maria.garcia@universidad.edu',
      password: passwordHash,
      id_area: areaRRHH.id_area,
    },
  });

  await prisma.usuarioRol.create({
    data: {
      id_usuario: responsable.id_usuario,
      id_rol: rolResponsable.id_rol,
    },
  });

  const trabajador = await prisma.usuario.create({
    data: {
      dni: '11223344',
      nombres: 'Carlos',
      apellidos: 'López',
      correo: 'carlos.lopez@universidad.edu',
      password: passwordHash,
      id_area: areaTI.id_area,
    },
  });

  await prisma.usuarioRol.create({
    data: {
      id_usuario: trabajador.id_usuario,
      id_rol: rolTrabajador.id_rol,
    },
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
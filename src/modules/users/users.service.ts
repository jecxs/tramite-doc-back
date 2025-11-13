import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FilterUserDto } from './dto/filter-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crear un nuevo usuario (solo ADMIN)
   */
  async create(createUserDto: CreateUserDto) {
    // Verificar que el área existe
    const area = await this.prisma.area.findUnique({
      where: { id_area: createUserDto.id_area },
    });

    if (!area) {
      throw new NotFoundException(
        `El área con ID ${createUserDto.id_area} no existe`,
      );
    }

    // Verificar que no exista un usuario con el mismo DNI
    const existeDni = await this.prisma.usuario.findUnique({
      where: { dni: createUserDto.dni },
    });

    if (existeDni) {
      throw new ConflictException(
        `Ya existe un usuario con el DNI ${createUserDto.dni}`,
      );
    }

    // Verificar que no exista un usuario con el mismo correo
    const existeCorreo = await this.prisma.usuario.findUnique({
      where: { correo: createUserDto.correo },
    });

    if (existeCorreo) {
      throw new ConflictException(
        `Ya existe un usuario con el correo ${createUserDto.correo}`,
      );
    }

    // Verificar que todos los roles existen
    const roles = await this.prisma.rol.findMany({
      where: { id_rol: { in: createUserDto.roles } },
    });

    if (roles.length !== createUserDto.roles.length) {
      throw new BadRequestException('Uno o más roles no existen');
    }

    // Hashear la contraseña
    const passwordHash = await bcrypt.hash(createUserDto.password, 10);

    // Crear el usuario y asignar roles en una transacción
    const usuario = await this.prisma.$transaction(async (tx) => {
      // Crear usuario
      const nuevoUsuario = await tx.usuario.create({
        data: {
          dni: createUserDto.dni,
          nombres: createUserDto.nombres,
          apellidos: createUserDto.apellidos,
          correo: createUserDto.correo,
          telefono: createUserDto.telefono,
          password: passwordHash,
          id_area: createUserDto.id_area,
        },
        include: {
          area: true,
        },
      });

      // Asignar roles
      await tx.usuarioRol.createMany({
        data: createUserDto.roles.map((id_rol) => ({
          id_usuario: nuevoUsuario.id_usuario,
          id_rol,
        })),
      });

      // Obtener usuario con roles
      const usuarioCompleto = await tx.usuario.findUnique({
        where: { id_usuario: nuevoUsuario.id_usuario },
        include: {
          area: true,
          roles: {
            include: {
              rol: true,
            },
          },
        },
      });

      if (!usuarioCompleto) {
        throw new Error('Error al crear el usuario');
      }

      return usuarioCompleto;
    });

    // Remover el password de la respuesta
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...usuarioSinPassword } = usuario;

    return {
      ...usuarioSinPassword,
      roles: usuario.roles.map((ur) => ({
        id_rol: ur.rol.id_rol,
        codigo: ur.rol.codigo,
        nombre: ur.rol.nombre,
      })),
    };
  }

  /**
   * Listar todos los usuarios con filtros opcionales
   */
  async findAll(filterDto?: FilterUserDto) {
    const where: any = {};

    // Aplicar filtros
    if (filterDto?.id_area) {
      where.id_area = filterDto.id_area;
    }

    if (filterDto?.activo !== undefined) {
      where.activo = filterDto.activo;
    }

    // Búsqueda por texto
    if (filterDto?.search) {
      where.OR = [
        { dni: { contains: filterDto.search, mode: 'insensitive' } },
        { nombres: { contains: filterDto.search, mode: 'insensitive' } },
        { apellidos: { contains: filterDto.search, mode: 'insensitive' } },
        { correo: { contains: filterDto.search, mode: 'insensitive' } },
      ];
    }

    // Filtro por rol
    let usuarios = await this.prisma.usuario.findMany({
      where,
      include: {
        area: true,
        roles: {
          include: {
            rol: true,
          },
        },
      },
      orderBy: {
        fecha_creacion: 'desc',
      },
    });

    // Filtrar por rol si se especifica
    if (filterDto?.id_rol) {
      usuarios = usuarios.filter((usuario) =>
        usuario.roles.some((ur) => ur.id_rol === filterDto.id_rol),
      );
    }

    // Remover passwords y formatear respuesta
    return usuarios.map((usuario) => {
      const { password, ...usuarioSinPassword } = usuario;
      return {
        ...usuarioSinPassword,
        roles: usuario.roles.map((ur) => ({
          id_rol: ur.rol.id_rol,
          codigo: ur.rol.codigo,
          nombre: ur.rol.nombre,
        })),
      };
    });
  }

  /**
   * Obtener un usuario por ID
   */
  async findOne(id: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id_usuario: id },
      include: {
        area: true,
        roles: {
          include: {
            rol: true,
          },
        },
      },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...usuarioSinPassword } = usuario;

    return {
      ...usuarioSinPassword,
      roles: usuario.roles.map((ur) => ({
        id_rol: ur.rol.id_rol,
        codigo: ur.rol.codigo,
        nombre: ur.rol.nombre,
      })),
    };
  }

  /**
   * Actualizar un usuario (solo ADMIN)
   */
  async update(id: string, updateUserDto: UpdateUserDto) {
    // Verificar que el usuario existe
    const usuarioExistente = await this.prisma.usuario.findUnique({
      where: { id_usuario: id },
    });

    if (!usuarioExistente) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    // Verificar que el área existe si se está actualizando
    if (updateUserDto.id_area) {
      const area = await this.prisma.area.findUnique({
        where: { id_area: updateUserDto.id_area },
      });

      if (!area) {
        throw new NotFoundException(
          `El área con ID ${updateUserDto.id_area} no existe`,
        );
      }
    }

    // Verificar que no exista otro usuario con el mismo DNI
    if (updateUserDto.dni) {
      const existeDni = await this.prisma.usuario.findUnique({
        where: { dni: updateUserDto.dni },
      });

      if (existeDni && existeDni.id_usuario !== id) {
        throw new ConflictException(
          `Ya existe otro usuario con el DNI ${updateUserDto.dni}`,
        );
      }
    }

    // Verificar que no exista otro usuario con el mismo correo
    if (updateUserDto.correo) {
      const existeCorreo = await this.prisma.usuario.findUnique({
        where: { correo: updateUserDto.correo },
      });

      if (existeCorreo && existeCorreo.id_usuario !== id) {
        throw new ConflictException(
          `Ya existe otro usuario con el correo ${updateUserDto.correo}`,
        );
      }
    }

    // Verificar que todos los roles existen si se están actualizando
    if (updateUserDto.roles) {
      const roles = await this.prisma.rol.findMany({
        where: { id_rol: { in: updateUserDto.roles } },
      });

      if (roles.length !== updateUserDto.roles.length) {
        throw new BadRequestException('Uno o más roles no existen');
      }
    }

    // Preparar datos para actualización
    const datosActualizacion: any = { ...updateUserDto };
    delete datosActualizacion.roles;

    // Hashear la nueva contraseña si se proporciona
    if (updateUserDto.password) {
      datosActualizacion.password = await bcrypt.hash(
        updateUserDto.password,
        10,
      );
    }

    // Actualizar usuario y roles en una transacción
    const usuario = await this.prisma.$transaction(async (tx) => {
      // Actualizar usuario
      const usuarioActualizado = await tx.usuario.update({
        where: { id_usuario: id },
        data: datosActualizacion,
        include: {
          area: true,
        },
      });

      // Actualizar roles si se proporcionan
      if (updateUserDto.roles) {
        // Eliminar roles anteriores
        await tx.usuarioRol.deleteMany({
          where: { id_usuario: id },
        });

        // Asignar nuevos roles
        await tx.usuarioRol.createMany({
          data: updateUserDto.roles.map((id_rol) => ({
            id_usuario: id,
            id_rol,
          })),
        });
      }

      // Obtener usuario con roles
      const usuarioCompleto = await tx.usuario.findUnique({
        where: { id_usuario: id },
        include: {
          area: true,
          roles: {
            include: {
              rol: true,
            },
          },
        },
      });

      if (!usuarioCompleto) {
        throw new Error('Error al actualizar el usuario');
      }

      return usuarioCompleto;
    });

    // Remover el password de la respuesta
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...usuarioSinPassword } = usuario;

    return {
      ...usuarioSinPassword,
      roles: usuario.roles.map((ur) => ({
        id_rol: ur.rol.id_rol,
        codigo: ur.rol.codigo,
        nombre: ur.rol.nombre,
      })),
    };
  }

  /**
   * Desactivar un usuario (soft delete) - solo ADMIN
   */
  async deactivate(id: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id_usuario: id },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    if (!usuario.activo) {
      throw new BadRequestException('El usuario ya está desactivado');
    }

    const usuarioDesactivado = await this.prisma.usuario.update({
      where: { id_usuario: id },
      data: { activo: false },
      include: {
        area: true,
        roles: {
          include: {
            rol: true,
          },
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...usuarioSinPassword } = usuarioDesactivado;

    return {
      ...usuarioSinPassword,
      roles: usuarioDesactivado.roles.map((ur) => ({
        id_rol: ur.rol.id_rol,
        codigo: ur.rol.codigo,
        nombre: ur.rol.nombre,
      })),
    };
  }

  /**
   * Activar un usuario - solo ADMIN
   */
  async activate(id: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id_usuario: id },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    if (usuario.activo) {
      throw new BadRequestException('El usuario ya está activo');
    }

    const usuarioActivado = await this.prisma.usuario.update({
      where: { id_usuario: id },
      data: { activo: true },
      include: {
        area: true,
        roles: {
          include: {
            rol: true,
          },
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...usuarioSinPassword } = usuarioActivado;

    return {
      ...usuarioSinPassword,
      roles: usuarioActivado.roles.map((ur) => ({
        id_rol: ur.rol.id_rol,
        codigo: ur.rol.codigo,
        nombre: ur.rol.nombre,
      })),
    };
  }

  /**
   * Eliminar permanentemente un usuario (solo en desarrollo/testing)
   */
  async remove(id: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException(
        'No se pueden eliminar usuarios permanentemente en producción. Use la desactivación.',
      );
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id_usuario: id },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    await this.prisma.usuario.delete({
      where: { id_usuario: id },
    });

    return { message: 'Usuario eliminado permanentemente' };
  }

  /**
   * Obtener estadísticas de usuarios
   */
  async getStatistics() {
    const [total, activos, inactivos, porArea, porRol] = await Promise.all([
      this.prisma.usuario.count(),
      this.prisma.usuario.count({ where: { activo: true } }),
      this.prisma.usuario.count({ where: { activo: false } }),
      this.prisma.usuario.groupBy({
        by: ['id_area'],
        _count: true,
      }),
      this.prisma.usuarioRol.groupBy({
        by: ['id_rol'],
        _count: true,
      }),
    ]);

    // Obtener nombres de áreas
    const areas = await this.prisma.area.findMany({
      where: {
        id_area: {
          in: porArea.map((a) => a.id_area),
        },
      },
    });

    // Obtener nombres de roles
    const roles = await this.prisma.rol.findMany({
      where: {
        id_rol: {
          in: porRol.map((r) => r.id_rol),
        },
      },
    });

    return {
      total,
      activos,
      inactivos,
      porArea: porArea.map((a) => ({
        id_area: a.id_area,
        nombre: areas.find((area) => area.id_area === a.id_area)?.nombre,
        cantidad: a._count,
      })),
      porRol: porRol.map((r) => ({
        id_rol: r.id_rol,
        nombre: roles.find((rol) => rol.id_rol === r.id_rol)?.nombre,
        codigo: roles.find((rol) => rol.id_rol === r.id_rol)?.codigo,
        cantidad: r._count,
      })),
    };
  }
}

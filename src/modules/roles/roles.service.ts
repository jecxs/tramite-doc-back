import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRolDto } from './dto/create-rol.dto';
import { UpdateRolDto } from './dto/update-rol.dto';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crear un nuevo rol (solo ADMIN)
   */
  async create(createRolDto: CreateRolDto) {
    // Verificar que no exista un rol con el mismo código
    const existeCodigo = await this.prisma.rol.findUnique({
      where: { codigo: createRolDto.codigo },
    });

    if (existeCodigo) {
      throw new ConflictException(
        `Ya existe un rol con el código ${createRolDto.codigo}`,
      );
    }

    // Verificar que no exista un rol con el mismo nombre
    const existeNombre = await this.prisma.rol.findUnique({
      where: { nombre: createRolDto.nombre },
    });

    if (existeNombre) {
      throw new ConflictException(
        `Ya existe un rol con el nombre ${createRolDto.nombre}`,
      );
    }

    const rol = await this.prisma.rol.create({
      data: createRolDto,
    });

    return rol;
  }

  /**
   * Listar todos los roles
   */
  async findAll(includeInactive = false) {
    const where = includeInactive ? {} : { activo: true };

    const roles = await this.prisma.rol.findMany({
      where,
      orderBy: {
        nombre: 'asc',
      },
      include: {
        _count: {
          select: {
            usuarios: true,
          },
        },
      },
    });

    return roles.map((rol) => ({
      ...rol,
      usuarios_count: rol._count.usuarios,
      _count: undefined,
    }));
  }

  /**
   * Obtener un rol por ID
   */
  async findOne(id: string) {
    const rol = await this.prisma.rol.findUnique({
      where: { id_rol: id },
      include: {
        _count: {
          select: {
            usuarios: true,
          },
        },
      },
    });

    if (!rol) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }

    return {
      ...rol,
      usuarios_count: rol._count.usuarios,
      _count: undefined,
    };
  }

  /**
   * Obtener un rol por código
   */
  async findByCodigo(codigo: string) {
    const rol = await this.prisma.rol.findUnique({
      where: { codigo },
      include: {
        _count: {
          select: {
            usuarios: true,
          },
        },
      },
    });

    if (!rol) {
      throw new NotFoundException(`Rol con código ${codigo} no encontrado`);
    }

    return {
      ...rol,
      usuarios_count: rol._count.usuarios,
      _count: undefined,
    };
  }

  /**
   * Actualizar un rol (solo ADMIN)
   */
  async update(id: string, updateRolDto: UpdateRolDto) {
    // Verificar que el rol existe
    const rolExistente = await this.prisma.rol.findUnique({
      where: { id_rol: id },
    });

    if (!rolExistente) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }

    // Verificar que no exista otro rol con el mismo código
    if (updateRolDto.codigo) {
      const existeCodigo = await this.prisma.rol.findUnique({
        where: { codigo: updateRolDto.codigo },
      });

      if (existeCodigo && existeCodigo.id_rol !== id) {
        throw new ConflictException(
          `Ya existe otro rol con el código ${updateRolDto.codigo}`,
        );
      }
    }

    // Verificar que no exista otro rol con el mismo nombre
    if (updateRolDto.nombre) {
      const existeNombre = await this.prisma.rol.findUnique({
        where: { nombre: updateRolDto.nombre },
      });

      if (existeNombre && existeNombre.id_rol !== id) {
        throw new ConflictException(
          `Ya existe otro rol con el nombre ${updateRolDto.nombre}`,
        );
      }
    }

    const rol = await this.prisma.rol.update({
      where: { id_rol: id },
      data: updateRolDto,
      include: {
        _count: {
          select: {
            usuarios: true,
          },
        },
      },
    });

    return {
      ...rol,
      usuarios_count: rol._count.usuarios,
      _count: undefined,
    };
  }

  /**
   * Desactivar un rol (no se puede eliminar si tiene usuarios)
   */
  async deactivate(id: string) {
    const rol = await this.prisma.rol.findUnique({
      where: { id_rol: id },
      include: {
        _count: {
          select: {
            usuarios: true,
          },
        },
      },
    });

    if (!rol) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }

    if (!rol.activo) {
      throw new BadRequestException('El rol ya está desactivado');
    }

    if (rol._count.usuarios > 0) {
      throw new BadRequestException(
        `No se puede desactivar el rol porque tiene ${rol._count.usuarios} usuario(s) asignado(s)`,
      );
    }

    const rolDesactivado = await this.prisma.rol.update({
      where: { id_rol: id },
      data: { activo: false },
    });

    return rolDesactivado;
  }

  /**
   * Activar un rol
   */
  async activate(id: string) {
    const rol = await this.prisma.rol.findUnique({
      where: { id_rol: id },
    });

    if (!rol) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }

    if (rol.activo) {
      throw new BadRequestException('El rol ya está activo');
    }

    const rolActivado = await this.prisma.rol.update({
      where: { id_rol: id },
      data: { activo: true },
    });

    return rolActivado;
  }

  /**
   * Eliminar permanentemente un rol (solo en desarrollo/testing)
   */
  async remove(id: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException(
        'No se pueden eliminar roles permanentemente en producción. Use la desactivación.',
      );
    }

    const rol = await this.prisma.rol.findUnique({
      where: { id_rol: id },
      include: {
        _count: {
          select: {
            usuarios: true,
          },
        },
      },
    });

    if (!rol) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }

    if (rol._count.usuarios > 0) {
      throw new BadRequestException(
        `No se puede eliminar el rol porque tiene ${rol._count.usuarios} usuario(s) asignado(s)`,
      );
    }

    await this.prisma.rol.delete({
      where: { id_rol: id },
    });

    return { message: 'Rol eliminado permanentemente' };
  }

  /**
   * Obtener usuarios asignados a un rol
   */
  async getUsersByRole(id: string) {
    const rol = await this.prisma.rol.findUnique({
      where: { id_rol: id },
      include: {
        usuarios: {
          include: {
            usuario: {
              include: {
                area: true,
              },
            },
          },
        },
      },
    });

    if (!rol) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }

    return {
      id_rol: rol.id_rol,
      codigo: rol.codigo,
      nombre: rol.nombre,
      usuarios: rol.usuarios.map((ur) => {
        const { password, ...usuarioSinPassword } = ur.usuario;
        return usuarioSinPassword;
      }),
    };
  }
}
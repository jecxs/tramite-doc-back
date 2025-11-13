import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';

@Injectable()
export class AreasService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crear una nueva área (solo ADMIN)
   */
  async create(createAreaDto: CreateAreaDto) {
    // Verificar que no exista un área con el mismo nombre
    const existeNombre = await this.prisma.area.findUnique({
      where: { nombre: createAreaDto.nombre },
    });

    if (existeNombre) {
      throw new ConflictException(
        `Ya existe un área con el nombre ${createAreaDto.nombre}`,
      );
    }

    const area = await this.prisma.area.create({
      data: createAreaDto,
    });

    return area;
  }

  /**
   * Listar todas las áreas
   */
  async findAll(includeInactive = false) {
    const where = includeInactive ? {} : { activo: true };

    const areas = await this.prisma.area.findMany({
      where,
      orderBy: {
        nombre: 'asc',
      },
      include: {
        _count: {
          select: {
            usuarios: true,
            tramitesRemitente: true,
          },
        },
      },
    });

    return areas.map((area) => ({
      ...area,
      usuarios_count: area._count.usuarios,
      tramites_count: area._count.tramitesRemitente,
      _count: undefined,
    }));
  }

  /**
   * Obtener un área por ID
   */
  async findOne(id: string) {
    const area = await this.prisma.area.findUnique({
      where: { id_area: id },
      include: {
        _count: {
          select: {
            usuarios: true,
            tramitesRemitente: true,
          },
        },
      },
    });

    if (!area) {
      throw new NotFoundException(`Área con ID ${id} no encontrada`);
    }

    return {
      ...area,
      usuarios_count: area._count.usuarios,
      tramites_count: area._count.tramitesRemitente,
      _count: undefined,
    };
  }

  /**
   * Obtener usuarios de un área
   */
  async getUsersByArea(id: string) {
    const area = await this.prisma.area.findUnique({
      where: { id_area: id },
      include: {
        usuarios: {
          where: { activo: true },
          include: {
            roles: {
              include: {
                rol: true,
              },
            },
          },
        },
      },
    });

    if (!area) {
      throw new NotFoundException(`Área con ID ${id} no encontrada`);
    }

    return {
      id_area: area.id_area,
      nombre: area.nombre,
      usuarios: area.usuarios.map((usuario) => {
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
      }),
    };
  }

  /**
   * Obtener responsables de un área (usuarios con rol RESP)
   */
  async getResponsablesByArea(id: string) {
    const area = await this.prisma.area.findUnique({
      where: { id_area: id },
    });

    if (!area) {
      throw new NotFoundException(`Área con ID ${id} no encontrada`);
    }

    // Buscar el rol RESP
    const rolResp = await this.prisma.rol.findUnique({
      where: { codigo: 'RESP' },
    });

    if (!rolResp) {
      throw new NotFoundException('Rol RESP no encontrado en el sistema');
    }

    // Obtener usuarios del área que tienen el rol RESP
    const usuarios = await this.prisma.usuario.findMany({
      where: {
        id_area: id,
        activo: true,
        roles: {
          some: {
            id_rol: rolResp.id_rol,
          },
        },
      },
      include: {
        roles: {
          include: {
            rol: true,
          },
        },
      },
    });

    return {
      id_area: area.id_area,
      nombre: area.nombre,
      responsables: usuarios.map((usuario) => {
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
      }),
    };
  }

  /**
   * Obtener trabajadores de un área (usuarios con rol TRAB)
   */
  async getTrabajadoresByArea(id: string) {
    const area = await this.prisma.area.findUnique({
      where: { id_area: id },
    });

    if (!area) {
      throw new NotFoundException(`Área con ID ${id} no encontrada`);
    }

    // Buscar el rol TRAB
    const rolTrab = await this.prisma.rol.findUnique({
      where: { codigo: 'TRAB' },
    });

    if (!rolTrab) {
      throw new NotFoundException('Rol TRAB no encontrado en el sistema');
    }

    // Obtener usuarios del área que tienen el rol TRAB
    const usuarios = await this.prisma.usuario.findMany({
      where: {
        id_area: id,
        activo: true,
        roles: {
          some: {
            id_rol: rolTrab.id_rol,
          },
        },
      },
      include: {
        roles: {
          include: {
            rol: true,
          },
        },
      },
    });

    return {
      id_area: area.id_area,
      nombre: area.nombre,
      trabajadores: usuarios.map((usuario) => {
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
      }),
    };
  }

  /**
   * Actualizar un área (solo ADMIN)
   */
  async update(id: string, updateAreaDto: UpdateAreaDto) {
    // Verificar que el área existe
    const areaExistente = await this.prisma.area.findUnique({
      where: { id_area: id },
    });

    if (!areaExistente) {
      throw new NotFoundException(`Área con ID ${id} no encontrada`);
    }

    // Verificar que no exista otra área con el mismo nombre
    if (updateAreaDto.nombre) {
      const existeNombre = await this.prisma.area.findUnique({
        where: { nombre: updateAreaDto.nombre },
      });

      if (existeNombre && existeNombre.id_area !== id) {
        throw new ConflictException(
          `Ya existe otra área con el nombre ${updateAreaDto.nombre}`,
        );
      }
    }

    const area = await this.prisma.area.update({
      where: { id_area: id },
      data: updateAreaDto,
      include: {
        _count: {
          select: {
            usuarios: true,
            tramitesRemitente: true,
          },
        },
      },
    });

    return {
      ...area,
      usuarios_count: area._count.usuarios,
      tramites_count: area._count.tramitesRemitente,
      _count: undefined,
    };
  }

  /**
   * Desactivar un área (no se puede si tiene usuarios activos)
   */
  async deactivate(id: string) {
    const area = await this.prisma.area.findUnique({
      where: { id_area: id },
      include: {
        _count: {
          select: {
            usuarios: {
              where: { activo: true },
            },
          },
        },
      },
    });

    if (!area) {
      throw new NotFoundException(`Área con ID ${id} no encontrada`);
    }

    if (!area.activo) {
      throw new BadRequestException('El área ya está desactivada');
    }

    if (area._count.usuarios > 0) {
      throw new BadRequestException(
        `No se puede desactivar el área porque tiene ${area._count.usuarios} usuario(s) activo(s)`,
      );
    }

    const areaDesactivada = await this.prisma.area.update({
      where: { id_area: id },
      data: { activo: false },
    });

    return areaDesactivada;
  }

  /**
   * Activar un área
   */
  async activate(id: string) {
    const area = await this.prisma.area.findUnique({
      where: { id_area: id },
    });

    if (!area) {
      throw new NotFoundException(`Área con ID ${id} no encontrada`);
    }

    if (area.activo) {
      throw new BadRequestException('El área ya está activa');
    }

    const areaActivada = await this.prisma.area.update({
      where: { id_area: id },
      data: { activo: true },
    });

    return areaActivada;
  }

  /**
   * Eliminar permanentemente un área (solo en desarrollo/testing)
   */
  async remove(id: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException(
        'No se pueden eliminar áreas permanentemente en producción. Use la desactivación.',
      );
    }

    const area = await this.prisma.area.findUnique({
      where: { id_area: id },
      include: {
        _count: {
          select: {
            usuarios: true,
          },
        },
      },
    });

    if (!area) {
      throw new NotFoundException(`Área con ID ${id} no encontrada`);
    }

    if (area._count.usuarios > 0) {
      throw new BadRequestException(
        `No se puede eliminar el área porque tiene ${area._count.usuarios} usuario(s) asignado(s)`,
      );
    }

    await this.prisma.area.delete({
      where: { id_area: id },
    });

    return { message: 'Área eliminada permanentemente' };
  }

  /**
   * Obtener estadísticas de áreas
   */
  async getStatistics() {
    const [total, activas, inactivas] = await Promise.all([
      this.prisma.area.count(),
      this.prisma.area.count({ where: { activo: true } }),
      this.prisma.area.count({ where: { activo: false } }),
    ]);

    // Obtener áreas con conteo de usuarios y trámites
    const areasConConteos = await this.prisma.area.findMany({
      include: {
        _count: {
          select: {
            usuarios: {
              where: { activo: true },
            },
            tramitesRemitente: true,
          },
        },
      },
      orderBy: {
        nombre: 'asc',
      },
    });

    return {
      total,
      activas,
      inactivas,
      areas: areasConConteos.map((area) => ({
        id_area: area.id_area,
        nombre: area.nombre,
        activo: area.activo,
        usuarios_activos: area._count.usuarios,
        tramites_enviados: area._count.tramitesRemitente,
      })),
    };
  }
}

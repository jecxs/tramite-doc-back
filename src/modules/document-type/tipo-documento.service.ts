import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTipoDocumentoDto } from './dto/create-tipo-documento.dto';
import { UpdateTipoDocumentoDto } from './dto/update-tipo-documento.dto';
import { config } from 'src/config';

@Injectable()
export class TipoDocumentoService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crear un nuevo tipo de documento (solo ADMIN)
   */
  async create(createTipoDocumentoDto: CreateTipoDocumentoDto) {
    // Verificar que no exista un tipo con el mismo código
    const existeCodigo = await this.prisma.tipoDocumento.findUnique({
      where: { codigo: createTipoDocumentoDto.codigo },
    });

    if (existeCodigo) {
      throw new ConflictException(
        `Ya existe un tipo de documento con el código ${createTipoDocumentoDto.codigo}`,
      );
    }

    // Verificar que no exista un tipo con el mismo nombre
    const existeNombre = await this.prisma.tipoDocumento.findUnique({
      where: { nombre: createTipoDocumentoDto.nombre },
    });

    if (existeNombre) {
      throw new ConflictException(
        `Ya existe un tipo de documento con el nombre ${createTipoDocumentoDto.nombre}`,
      );
    }

    const tipoDocumento = await this.prisma.tipoDocumento.create({
      data: createTipoDocumentoDto,
    });

    return tipoDocumento;
  }

  /**
   * Listar todos los tipos de documento
   * Acceso: ADMIN, RESP (todos pueden ver los tipos para clasificar documentos)
   */
  async findAll() {
    const tiposDocumento = await this.prisma.tipoDocumento.findMany({
      orderBy: {
        nombre: 'asc',
      },
      include: {
        _count: {
          select: {
            documentos: true,
          },
        },
      },
    });

    return tiposDocumento.map((tipo) => ({
      ...tipo,
      documentos_count: tipo._count.documentos,
      _count: undefined,
    }));
  }

  /**
   * Obtener un tipo de documento por ID
   */
  async findOne(id: string) {
    const tipoDocumento = await this.prisma.tipoDocumento.findUnique({
      where: { id_tipo: id },
      include: {
        _count: {
          select: {
            documentos: true,
          },
        },
      },
    });

    if (!tipoDocumento) {
      throw new NotFoundException(
        `Tipo de documento con ID ${id} no encontrado`,
      );
    }

    return {
      ...tipoDocumento,
      documentos_count: tipoDocumento._count.documentos,
      _count: undefined,
    };
  }

  /**
   * Obtener un tipo de documento por código
   */
  async findByCodigo(codigo: string) {
    const tipoDocumento = await this.prisma.tipoDocumento.findUnique({
      where: { codigo },
      include: {
        _count: {
          select: {
            documentos: true,
          },
        },
      },
    });

    if (!tipoDocumento) {
      throw new NotFoundException(
        `Tipo de documento con código ${codigo} no encontrado`,
      );
    }

    return {
      ...tipoDocumento,
      documentos_count: tipoDocumento._count.documentos,
      _count: undefined,
    };
  }

  /**
   * Obtener tipos de documento que requieren firma
   * Útil para filtrar documentos que necesitan firma electrónica
   */
  async findRequiereFirma() {
    const tiposDocumento = await this.prisma.tipoDocumento.findMany({
      where: { requiere_firma: true },
      orderBy: {
        nombre: 'asc',
      },
    });

    return tiposDocumento;
  }

  /**
   * Obtener tipos de documento que requieren respuesta
   * Útil para filtrar documentos que necesitan respuesta del trabajador
   */
  async findRequiereRespuesta() {
    const tiposDocumento = await this.prisma.tipoDocumento.findMany({
      where: { requiere_respuesta: true },
      orderBy: {
        nombre: 'asc',
      },
    });

    return tiposDocumento;
  }

  /**
   * Actualizar un tipo de documento (solo ADMIN)
   */
  async update(id: string, updateTipoDocumentoDto: UpdateTipoDocumentoDto) {
    // Verificar que el tipo de documento existe
    const tipoExistente = await this.prisma.tipoDocumento.findUnique({
      where: { id_tipo: id },
    });

    if (!tipoExistente) {
      throw new NotFoundException(
        `Tipo de documento con ID ${id} no encontrado`,
      );
    }

    // Verificar que no exista otro tipo con el mismo código
    if (updateTipoDocumentoDto.codigo) {
      const existeCodigo = await this.prisma.tipoDocumento.findUnique({
        where: { codigo: updateTipoDocumentoDto.codigo },
      });

      if (existeCodigo && existeCodigo.id_tipo !== id) {
        throw new ConflictException(
          `Ya existe otro tipo de documento con el código ${updateTipoDocumentoDto.codigo}`,
        );
      }
    }

    // Verificar que no exista otro tipo con el mismo nombre
    if (updateTipoDocumentoDto.nombre) {
      const existeNombre = await this.prisma.tipoDocumento.findUnique({
        where: { nombre: updateTipoDocumentoDto.nombre },
      });

      if (existeNombre && existeNombre.id_tipo !== id) {
        throw new ConflictException(
          `Ya existe otro tipo de documento con el nombre ${updateTipoDocumentoDto.nombre}`,
        );
      }
    }

    const tipoDocumento = await this.prisma.tipoDocumento.update({
      where: { id_tipo: id },
      data: updateTipoDocumentoDto,
      include: {
        _count: {
          select: {
            documentos: true,
          },
        },
      },
    });

    return {
      ...tipoDocumento,
      documentos_count: tipoDocumento._count.documentos,
      _count: undefined,
    };
  }

  /**
   * Eliminar un tipo de documento (solo desarrollo/testing)
   * En producción, mejor desactivar o no permitir eliminar
   */
  async remove(id: string) {
    if (config.NODE_ENV === 'production') {
      throw new BadRequestException(
        'No se pueden eliminar tipos de documento en producción',
      );
    }

    const tipoDocumento = await this.prisma.tipoDocumento.findUnique({
      where: { id_tipo: id },
      include: {
        _count: {
          select: {
            documentos: true,
          },
        },
      },
    });

    if (!tipoDocumento) {
      throw new NotFoundException(
        `Tipo de documento con ID ${id} no encontrado`,
      );
    }

    if (tipoDocumento._count.documentos > 0) {
      throw new BadRequestException(
        `No se puede eliminar el tipo de documento porque tiene ${tipoDocumento._count.documentos} documento(s) asociado(s)`,
      );
    }

    await this.prisma.tipoDocumento.delete({
      where: { id_tipo: id },
    });

    return { message: 'Tipo de documento eliminado permanentemente' };
  }

  /**
   * Obtener estadísticas de tipos de documento
   */
  async getStatistics() {
    const [total, conFirma, conRespuesta] = await Promise.all([
      this.prisma.tipoDocumento.count(),
      this.prisma.tipoDocumento.count({ where: { requiere_firma: true } }),
      this.prisma.tipoDocumento.count({ where: { requiere_respuesta: true } }),
    ]);

    // Obtener tipos con conteo de documentos
    const tiposConConteos = await this.prisma.tipoDocumento.findMany({
      include: {
        _count: {
          select: {
            documentos: true,
          },
        },
      },
      orderBy: {
        nombre: 'asc',
      },
    });

    return {
      total,
      requieren_firma: conFirma,
      requieren_respuesta: conRespuesta,
      tipos: tiposConConteos.map((tipo) => ({
        id_tipo: tipo.id_tipo,
        codigo: tipo.codigo,
        nombre: tipo.nombre,
        requiere_firma: tipo.requiere_firma,
        requiere_respuesta: tipo.requiere_respuesta,
        documentos_count: tipo._count.documentos,
      })),
    };
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { R2Service } from '../../common/services/r2.service';
import { UploadDocumentoDto } from './dto/upload-documento.dto';
import { FilterDocumentoDto } from './dto/filter-documento.dto';

@Injectable()
export class DocumentosService {
  constructor(
    private prisma: PrismaService,
    private r2Service: R2Service,
  ) {}

  /**
   * Subir un nuevo documento
   * Sube el archivo a R2 y guarda la metadata en la base de datos
   */
  async upload(
    uploadDocumentoDto: UploadDocumentoDto,
    file: Express.Multer.File,
    userId: string,
  ) {
    // Validar que el tipo de documento existe
    const tipoDocumento = await this.prisma.tipoDocumento.findUnique({
      where: { id_tipo: uploadDocumentoDto.id_tipo },
    });

    if (!tipoDocumento) {
      throw new NotFoundException(
        `Tipo de documento con ID ${uploadDocumentoDto.id_tipo} no encontrado`,
      );
    }

    // Validar extensión del archivo
    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];
    const extension = file.originalname
      .substring(file.originalname.lastIndexOf('.'))
      .toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      throw new BadRequestException(
        `Extensión ${extension} no permitida. Solo se permiten: ${allowedExtensions.join(', ')}`,
      );
    }

    // Validar tamaño del archivo (máximo 10MB por defecto)
    const maxSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || '10');
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      throw new BadRequestException(
        `El archivo excede el tamaño máximo permitido de ${maxSizeMB}MB`,
      );
    }

    // Generar ruta única en R2
    const rutaArchivo = this.r2Service.generateFilePath(
      file.originalname,
      userId,
    );

    // Subir archivo a R2
    await this.r2Service.uploadFile(file.buffer, rutaArchivo, file.mimetype, {
      titulo: uploadDocumentoDto.titulo,
      tipo: tipoDocumento.codigo,
      usuario: userId,
    });

    // Guardar metadata en base de datos
    const documento = await this.prisma.documento.create({
      data: {
        titulo: uploadDocumentoDto.titulo,
        ruta_archivo: rutaArchivo,
        nombre_archivo: file.originalname,
        extension: extension,
        tamano_bytes: BigInt(file.size),
        id_tipo: uploadDocumentoDto.id_tipo,
        creado_por: userId,
      },
      include: {
        tipo: true,
        creador: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
            correo: true,
          },
        },
      },
    });

    return {
      ...documento,
      tamano_bytes: documento.tamano_bytes.toString(), // Convertir BigInt a string para JSON
    };
  }

  /**
   * Listar documentos con filtros opcionales
   */
  async findAll(filterDto?: FilterDocumentoDto) {
    const where: any = {};

    // Aplicar filtros
    if (filterDto?.id_tipo) {
      where.id_tipo = filterDto.id_tipo;
    }

    if (filterDto?.creado_por) {
      where.creado_por = filterDto.creado_por;
    }

    if (filterDto?.extension) {
      where.extension = filterDto.extension;
    }

    // Búsqueda por texto
    if (filterDto?.search) {
      where.OR = [
        { titulo: { contains: filterDto.search, mode: 'insensitive' } },
        {
          nombre_archivo: { contains: filterDto.search, mode: 'insensitive' },
        },
      ];
    }

    const documentos = await this.prisma.documento.findMany({
      where,
      include: {
        tipo: true,
        creador: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
            correo: true,
            area: true,
          },
        },
      },
      orderBy: {
        fecha_creacion: 'desc',
      },
    });

    return documentos.map((doc) => ({
      ...doc,
      tamano_bytes: doc.tamano_bytes.toString(),
    }));
  }

  /**
   * Obtener un documento por ID
   */
  async findOne(id: string) {
    const documento = await this.prisma.documento.findUnique({
      where: { id_documento: id },
      include: {
        tipo: true,
        creador: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
            correo: true,
            area: true,
          },
        },
        versionesPosteriores: {
          include: {
            tipo: true,
          },
        },
      },
    });

    if (!documento) {
      throw new NotFoundException(`Documento con ID ${id} no encontrado`);
    }

    return {
      ...documento,
      tamano_bytes: documento.tamano_bytes.toString(),
      versionesPosteriores: documento.versionesPosteriores.map((v) => ({
        ...v,
        tamano_bytes: v.tamano_bytes.toString(),
      })),
    };
  }

  /**
   * Obtener URL firmada para descargar un documento
   * La URL expira en 1 hora por defecto
   */
  async getDownloadUrl(id: string, userId: string) {
    const documento = await this.prisma.documento.findUnique({
      where: { id_documento: id },
      include: {
        tramites: {
          include: {
            remitente: true,
            receptor: true,
          },
        },
      },
    });

    if (!documento) {
      throw new NotFoundException(`Documento con ID ${id} no encontrado`);
    }

    // Verificar permisos: el documento puede ser descargado por:
    // 1. El creador del documento
    // 2. El remitente de un trámite que use este documento
    // 3. El receptor de un trámite que use este documento
    const tienePermiso =
      documento.creado_por === userId ||
      documento.tramites.some(
        (t) => t.id_remitente === userId || t.id_receptor === userId,
      );

    if (!tienePermiso) {
      throw new BadRequestException(
        'No tiene permisos para descargar este documento',
      );
    }

    // Generar URL firmada temporal (válida por 1 hora)
    const downloadUrl = await this.r2Service.getSignedDownloadUrl(
      documento.ruta_archivo,
      3600,
    );

    return {
      id_documento: documento.id_documento,
      titulo: documento.titulo,
      nombre_archivo: documento.nombre_archivo,
      download_url: downloadUrl,
      expires_in: 3600, // segundos
    };
  }

  /**
   * Crear nueva versión de un documento (para reenvíos con correcciones)
   */
  async createVersion(
    idDocumentoAnterior: string,
    uploadDocumentoDto: UploadDocumentoDto,
    file: Express.Multer.File,
    userId: string,
  ) {
    // Verificar que el documento anterior existe
    const documentoAnterior = await this.prisma.documento.findUnique({
      where: { id_documento: idDocumentoAnterior },
      include: {
        versionesPosteriores: true,
      },
    });

    if (!documentoAnterior) {
      throw new NotFoundException(
        `Documento anterior con ID ${idDocumentoAnterior} no encontrado`,
      );
    }

    // Calcular número de versión
    const numeroVersion = documentoAnterior.version + 1;

    // Validar tipo y extensión (igual que en upload)
    const tipoDocumento = await this.prisma.tipoDocumento.findUnique({
      where: { id_tipo: uploadDocumentoDto.id_tipo },
    });

    if (!tipoDocumento) {
      throw new NotFoundException(
        `Tipo de documento con ID ${uploadDocumentoDto.id_tipo} no encontrado`,
      );
    }

    const extension = file.originalname
      .substring(file.originalname.lastIndexOf('.'))
      .toLowerCase();

    // Generar ruta para la nueva versión
    const rutaArchivo = this.r2Service.generateVersionPath(
      documentoAnterior.ruta_archivo,
      numeroVersion,
    );

    // Subir nueva versión a R2
    await this.r2Service.uploadFile(file.buffer, rutaArchivo, file.mimetype, {
      titulo: uploadDocumentoDto.titulo,
      tipo: tipoDocumento.codigo,
      version: numeroVersion.toString(),
      documento_anterior: idDocumentoAnterior,
    });

    // Crear nueva versión en base de datos
    const nuevaVersion = await this.prisma.documento.create({
      data: {
        titulo: uploadDocumentoDto.titulo,
        ruta_archivo: rutaArchivo,
        nombre_archivo: file.originalname,
        extension: extension,
        tamano_bytes: BigInt(file.size),
        id_tipo: uploadDocumentoDto.id_tipo,
        version: numeroVersion,
        id_documento_anterior: idDocumentoAnterior,
        creado_por: userId,
      },
      include: {
        tipo: true,
        creador: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
            correo: true,
          },
        },
        documentoAnterior: {
          select: {
            id_documento: true,
            titulo: true,
            version: true,
          },
        },
      },
    });

    return {
      ...nuevaVersion,
      tamano_bytes: nuevaVersion.tamano_bytes.toString(),
    };
  }

  /**
   * Eliminar un documento (solo desarrollo/testing)
   */
  async remove(id: string, userId: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException(
        'No se pueden eliminar documentos en producción',
      );
    }

    const documento = await this.prisma.documento.findUnique({
      where: { id_documento: id },
      include: {
        _count: {
          select: {
            tramites: true,
          },
        },
      },
    });

    if (!documento) {
      throw new NotFoundException(`Documento con ID ${id} no encontrado`);
    }

    // Solo el creador puede eliminar
    if (documento.creado_por !== userId) {
      throw new BadRequestException(
        'Solo el creador puede eliminar el documento',
      );
    }

    // No se puede eliminar si tiene trámites asociados
    if (documento._count.tramites > 0) {
      throw new BadRequestException(
        `No se puede eliminar el documento porque tiene ${documento._count.tramites} trámite(s) asociado(s)`,
      );
    }

    // Eliminar de R2
    await this.r2Service.deleteFile(documento.ruta_archivo);

    // Eliminar de base de datos
    await this.prisma.documento.delete({
      where: { id_documento: id },
    });

    return { message: 'Documento eliminado permanentemente' };
  }

  /**
   * Obtener estadísticas de documentos
   */
  async getStatistics() {
    const [total, porTipo, porExtension] = await Promise.all([
      this.prisma.documento.count(),
      this.prisma.documento.groupBy({
        by: ['id_tipo'],
        _count: true,
      }),
      this.prisma.documento.groupBy({
        by: ['extension'],
        _count: true,
      }),
    ]);

    // Obtener tipos de documento
    const tipos = await this.prisma.tipoDocumento.findMany({
      where: {
        id_tipo: {
          in: porTipo.map((t) => t.id_tipo),
        },
      },
    });

    // Calcular tamaño total
    const tamanoTotal = await this.prisma.documento.aggregate({
      _sum: {
        tamano_bytes: true,
      },
    });

    return {
      total,
      tamano_total_bytes: tamanoTotal._sum.tamano_bytes?.toString() || '0',
      por_tipo: porTipo.map((t) => ({
        id_tipo: t.id_tipo,
        nombre: tipos.find((tipo) => tipo.id_tipo === t.id_tipo)?.nombre,
        cantidad: t._count,
      })),
      por_extension: porExtension.map((e) => ({
        extension: e.extension,
        cantidad: e._count,
      })),
    };
  }
  /**
   * Obtener trámites asociados a un documento (para verificar permisos)
   */
  async getTramitesByDocumento(idDocumento: string) {
    return this.prisma.tramite.findMany({
      where: { id_documento: idDocumento },
      select: {
        id_tramite: true,
        id_remitente: true,
        id_receptor: true,
      },
    });
  }
}

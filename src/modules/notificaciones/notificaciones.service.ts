import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateNotificacionDto } from './dto/create-notificacion.dto';
import { FilterNotificacionDto } from './dto/filter-notificacion.dto';
import { NotificacionesGateway } from '../observacion/notificaciones.gateway';

@Injectable()
export class NotificacionesService {
  constructor(
    private prisma: PrismaService,
    private notificacionesGateway: NotificacionesGateway,
  ) {}

  /**
   * Crear una notificación
   * Se guarda en BD y se envía por WebSocket si el usuario está conectado
   */
  async create(createNotificacionDto: CreateNotificacionDto) {
    // Verificar que el usuario existe
    const usuario = await this.prisma.usuario.findUnique({
      where: { id_usuario: createNotificacionDto.id_usuario },
    });

    if (!usuario) {
      throw new NotFoundException(
        `Usuario con ID ${createNotificacionDto.id_usuario} no encontrado`,
      );
    }

    // Verificar que el trámite existe si se proporciona
    if (createNotificacionDto.id_tramite) {
      const tramite = await this.prisma.tramite.findUnique({
        where: { id_tramite: createNotificacionDto.id_tramite },
      });

      if (!tramite) {
        throw new NotFoundException(
          `Trámite con ID ${createNotificacionDto.id_tramite} no encontrado`,
        );
      }
    }

    // Crear notificación en BD
    const notificacion = await this.prisma.notificacion.create({
      data: createNotificacionDto,
      include: {
        tramite: {
          select: {
            codigo: true,
            asunto: true,
          },
        },
      },
    });

    // Enviar por WebSocket si el usuario está conectado
    this.notificacionesGateway.enviarNotificacionAUsuario(
      createNotificacionDto.id_usuario,
      {
        id_notificacion: notificacion.id_notificacion,
        tipo: notificacion.tipo,
        titulo: notificacion.titulo,
        mensaje: notificacion.mensaje,
        fecha_creacion: notificacion.fecha_creacion,
        tramite: notificacion.tramite,
      },
    );

    return notificacion;
  }

  /**
   * Métodos auxiliares para crear notificaciones específicas
   * Estos métodos simplifican la creación desde otros servicios
   */

  /**
   * Notificar que se recibió un nuevo trámite
   */
  async notificarTramiteRecibido(
    idReceptor: string,
    idTramite: string,
    nombreRemitente: string,
    asuntoTramite: string,
  ) {
    return this.create({
      id_usuario: idReceptor,
      id_tramite: idTramite,
      tipo: 'TRAMITE_RECIBIDO',
      titulo: 'Nuevo documento recibido',
      mensaje: `${nombreRemitente} le ha enviado un documento: ${asuntoTramite}`,
    });
  }

  /**
   * Notificar que un documento fue firmado
   */
  async notificarDocumentoFirmado(
    idRemitente: string,
    idTramite: string,
    nombreTrabajador: string,
    asuntoTramite: string,
  ) {
    return this.create({
      id_usuario: idRemitente,
      id_tramite: idTramite,
      tipo: 'TRAMITE_FIRMADO',
      titulo: 'Documento firmado',
      mensaje: `${nombreTrabajador} ha firmado el documento: ${asuntoTramite}`,
    });
  }

  /**
   * Notificar que un trámite fue anulado
   */
  async notificarTramiteAnulado(
    idReceptor: string,
    idTramite: string,
    asuntoTramite: string,
    motivo: string,
  ) {
    return this.create({
      id_usuario: idReceptor,
      id_tramite: idTramite,
      tipo: 'TRAMITE_ANULADO',
      titulo: 'Trámite anulado',
      mensaje: `El trámite "${asuntoTramite}" ha sido anulado. Motivo: ${motivo}`,
    });
  }

  /**
   * Notificar que se creó una observación
   */
  async notificarObservacionCreada(
    idRemitente: string,
    idTramite: string,
    nombreTrabajador: string,
    tipoObservacion: string,
  ) {
    return this.create({
      id_usuario: idRemitente,
      id_tramite: idTramite,
      tipo: 'OBSERVACION_CREADA',
      titulo: 'Nueva observación',
      mensaje: `${nombreTrabajador} ha creado una observación de tipo ${tipoObservacion}`,
    });
  }

  /**
   * Notificar que una observación fue resuelta
   */
  async notificarObservacionResuelta(
    idTrabajador: string,
    idTramite: string,
    nombreResponsable: string,
  ) {
    return this.create({
      id_usuario: idTrabajador,
      id_tramite: idTramite,
      tipo: 'OBSERVACION_RESUELTA',
      titulo: 'Observación resuelta',
      mensaje: `${nombreResponsable} ha respondido a su observación`,
    });
  }

  /**
   * Notificar que un documento requiere firma
   */
  async notificarDocumentoRequiereFirma(
    idReceptor: string,
    idTramite: string,
    asuntoTramite: string,
  ) {
    return this.create({
      id_usuario: idReceptor,
      id_tramite: idTramite,
      tipo: 'DOCUMENTO_REQUIERE_FIRMA',
      titulo: 'Documento requiere firma',
      mensaje: `El documento "${asuntoTramite}" requiere su firma electrónica`,
    });
  }

  /**
   * Notificar que un trámite fue reenviado con correcciones
   */
  async notificarTramiteReenviado(
    idReceptor: string,
    idTramite: string,
    asuntoTramite: string,
    numeroVersion: number,
  ) {
    return this.create({
      id_usuario: idReceptor,
      id_tramite: idTramite,
      tipo: 'TRAMITE_REENVIADO',
      titulo: 'Documento actualizado',
      mensaje: `Se ha enviado una nueva versión (v${numeroVersion}) del documento: ${asuntoTramite}`,
    });
  }

  /**
   * Listar notificaciones del usuario
   */
  async findAll(userId: string, filterDto?: FilterNotificacionDto) {
    const where: any = {
      id_usuario: userId,
    };

    // Aplicar filtros
    if (filterDto?.visto !== undefined) {
      where.visto = filterDto.visto;
    }

    if (filterDto?.tipo) {
      where.tipo = filterDto.tipo;
    }

    const notificaciones = await this.prisma.notificacion.findMany({
      where,
      include: {
        tramite: {
          select: {
            codigo: true,
            asunto: true,
            estado: true,
          },
        },
      },
      orderBy: {
        fecha_creacion: 'desc',
      },
    });

    return notificaciones;
  }

  /**
   * Obtener notificaciones no leídas
   */
  async findUnread(userId: string) {
    const notificaciones = await this.prisma.notificacion.findMany({
      where: {
        id_usuario: userId,
        visto: false,
      },
      include: {
        tramite: {
          select: {
            codigo: true,
            asunto: true,
            estado: true,
          },
        },
      },
      orderBy: {
        fecha_creacion: 'desc',
      },
    });

    return notificaciones;
  }

  /**
   * Obtener contador de notificaciones no leídas
   */
  async getUnreadCount(userId: string) {
    const count = await this.prisma.notificacion.count({
      where: {
        id_usuario: userId,
        visto: false,
      },
    });

    return { count };
  }

  /**
   * Obtener una notificación por ID
   */
  async findOne(id: string, userId: string) {
    const notificacion = await this.prisma.notificacion.findUnique({
      where: { id_notificacion: id },
      include: {
        tramite: {
          select: {
            codigo: true,
            asunto: true,
            estado: true,
            id_tramite: true,
          },
        },
      },
    });

    if (!notificacion) {
      throw new NotFoundException(`Notificación con ID ${id} no encontrada`);
    }

    // Verificar que la notificación pertenece al usuario
    if (notificacion.id_usuario !== userId) {
      throw new ForbiddenException(
        'No tiene permisos para ver esta notificación',
      );
    }

    return notificacion;
  }

  /**
   * Marcar una notificación como vista
   */
  async markAsRead(id: string, userId: string) {
    const notificacion = await this.prisma.notificacion.findUnique({
      where: { id_notificacion: id },
    });

    if (!notificacion) {
      throw new NotFoundException(`Notificación con ID ${id} no encontrada`);
    }

    // Verificar que la notificación pertenece al usuario
    if (notificacion.id_usuario !== userId) {
      throw new ForbiddenException(
        'No tiene permisos para modificar esta notificación',
      );
    }

    const notificacionActualizada = await this.prisma.notificacion.update({
      where: { id_notificacion: id },
      data: {
        visto: true,
        fecha_visto: new Date(),
      },
    });

    return notificacionActualizada;
  }

  /**
   * Marcar todas las notificaciones como vistas
   */
  async markAllAsRead(userId: string) {
    const result = await this.prisma.notificacion.updateMany({
      where: {
        id_usuario: userId,
        visto: false,
      },
      data: {
        visto: true,
        fecha_visto: new Date(),
      },
    });

    return {
      message: 'Todas las notificaciones han sido marcadas como leídas',
      count: result.count,
    };
  }

  /**
   * Eliminar notificaciones antiguas (opcional - para limpieza)
   * Elimina notificaciones vistas con más de 90 días
   */
  async deleteOldNotifications() {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - 90);

    const result = await this.prisma.notificacion.deleteMany({
      where: {
        visto: true,
        fecha_visto: {
          lt: fechaLimite,
        },
      },
    });

    return {
      message: 'Notificaciones antiguas eliminadas',
      count: result.count,
    };
  }

  /**
   * Obtener estadísticas de notificaciones
   */
  async getStatistics(userId: string) {
    const [total, noLeidas, porTipo] = await Promise.all([
      this.prisma.notificacion.count({
        where: { id_usuario: userId },
      }),
      this.prisma.notificacion.count({
        where: { id_usuario: userId, visto: false },
      }),
      this.prisma.notificacion.groupBy({
        by: ['tipo'],
        where: { id_usuario: userId },
        _count: true,
      }),
    ]);

    return {
      total,
      no_leidas: noLeidas,
      leidas: total - noLeidas,
      por_tipo: porTipo.map((item) => ({
        tipo: item.tipo,
        cantidad: item._count,
      })),
    };
  }
}
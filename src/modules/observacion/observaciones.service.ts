import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateObservacionDto } from './dto/create-observacion.dto';
import { ResponderObservacionDto } from './dto/responder-observacion.dto';
import { NotificacionesGateway } from './notificaciones.gateway';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

@Injectable()
export class ObservacionesService {
  constructor(
    private prisma: PrismaService,
    private notificacionesGateway: NotificacionesGateway,
    private notificacionesService: NotificacionesService,
  ) {}

  /**
   * Crear una observación en un trámite
   * Solo el receptor (trabajador) puede crear observaciones
   */
  async create(
    idTramite: string,
    createObservacionDto: CreateObservacionDto,
    userId: string,
  ) {
    // Verificar que el trámite existe
    const tramite = await this.prisma.tramite.findUnique({
      where: { id_tramite: idTramite },
      include: {
        documento: {
          include: {
            tipo: true,
          },
        },
        remitente: {
          select: {
            nombres: true,
            apellidos: true,
          },
        },
        receptor: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
            correo: true,
          },
        },
      },
    });

    if (!tramite) {
      throw new NotFoundException(`Trámite con ID ${idTramite} no encontrado`);
    }

    // Solo el receptor puede crear observaciones
    if (tramite.id_receptor !== userId) {
      throw new ForbiddenException(
        'Solo el receptor del trámite puede crear observaciones',
      );
    }

    // Verificar que el trámite esté en un estado válido para observaciones
    if (tramite.estado === 'ANULADO') {
      throw new BadRequestException(
        'No se pueden crear observaciones en un trámite anulado',
      );
    }

    if (tramite.estado === 'FIRMADO') {
      throw new BadRequestException(
        'No se pueden crear observaciones en un trámite ya firmado',
      );
    }

    // Guardar estado anterior para el historial
    const estadoAnterior = tramite.estado;

    // Crear la observación
    const observacion = await this.prisma.observacion.create({
      data: {
        id_tramite: idTramite,
        creado_por: userId,
        tipo: createObservacionDto.tipo,
        descripcion: createObservacionDto.descripcion,
      },
      include: {
        tramite: {
          include: {
            documento: {
              select: {
                titulo: true,
              },
            },
          },
        },
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

    // Actualizar estado del trámite a "CON_OBSERVACION"
    // Esto permite distinguir trámites que tienen observaciones pendientes
    await this.prisma.tramite.update({
      where: { id_tramite: idTramite },
      data: {
        // Mantenemos el estado actual pero registramos que tiene observación
        // Esto es importante para que el historial tenga sentido
      },
    });

    // Registrar en historial CON ESTADOS
    await this.prisma.historialTramite.create({
      data: {
        id_tramite: idTramite,
        accion: 'OBSERVACION',
        detalle: `Observación creada: ${createObservacionDto.tipo} - ${createObservacionDto.descripcion}`,
        estado_anterior: estadoAnterior,
        estado_nuevo: estadoAnterior, // El estado no cambia, pero registramos que se mantiene
        realizado_por: userId,
        datos_adicionales: {
          tipo_observacion: createObservacionDto.tipo,
          descripcion: createObservacionDto.descripcion,
          id_observacion: observacion.id_observacion, // Para referencia
        },
      },
    });

    // Crear notificación persistente en BD
    await this.notificacionesService.notificarObservacionCreada(
      tramite.id_remitente,
      idTramite,
      `${tramite.receptor.nombres} ${tramite.receptor.apellidos}`,
      createObservacionDto.tipo,
    );

    // Enviar notificación en tiempo real vía WebSocket
    const notificacion = {
      id_observacion: observacion.id_observacion,
      tipo: observacion.tipo,
      descripcion: observacion.descripcion,
      fecha_creacion: observacion.fecha_creacion,
      tramite: {
        id_tramite: tramite.id_tramite,
        codigo: tramite.codigo,
        asunto: tramite.asunto,
        documento: {
          titulo: tramite.documento.titulo,
        },
      },
      creador: observacion.creador,
    };

    this.notificacionesGateway.enviarNotificacionAUsuario(
      tramite.id_remitente,
      notificacion,
    );

    return observacion;
  }

  /**
   * Listar observaciones de un trámite
   */
  async findByTramite(idTramite: string, userId: string, userRoles: string[]) {
    const tramite = await this.prisma.tramite.findUnique({
      where: { id_tramite: idTramite },
    });

    if (!tramite) {
      throw new NotFoundException(`Trámite con ID ${idTramite} no encontrado`);
    }

    // Verificar permisos - ADMIN, remitente o receptor
    const tieneAcceso =
      userRoles.includes('ADMIN') ||
      tramite.id_remitente === userId ||
      tramite.id_receptor === userId;

    if (!tieneAcceso) {
      throw new ForbiddenException(
        'No tiene permisos para ver las observaciones de este trámite',
      );
    }

    const observaciones = await this.prisma.observacion.findMany({
      where: { id_tramite: idTramite },
      include: {
        creador: {
          select: {
            nombres: true,
            apellidos: true,
            correo: true,
          },
        },
        resolutor: {
          select: {
            nombres: true,
            apellidos: true,
            correo: true,
          },
        },
      },
      orderBy: {
        fecha_creacion: 'desc',
      },
    });

    return observaciones;
  }

  /**
   * Obtener una observación por ID
   */
  async findOne(id: string, userId: string, userRoles: string[]) {
    const observacion = await this.prisma.observacion.findUnique({
      where: { id_observacion: id },
      include: {
        tramite: {
          include: {
            documento: {
              select: {
                titulo: true,
              },
            },
          },
        },
        creador: {
          select: {
            nombres: true,
            apellidos: true,
            correo: true,
          },
        },
        resolutor: {
          select: {
            nombres: true,
            apellidos: true,
            correo: true,
          },
        },
      },
    });

    if (!observacion) {
      throw new NotFoundException(`Observación con ID ${id} no encontrada`);
    }

    // Verificar permisos
    const tieneAcceso =
      userRoles.includes('ADMIN') ||
      observacion.tramite.id_remitente === userId ||
      observacion.tramite.id_receptor === userId;

    if (!tieneAcceso) {
      throw new ForbiddenException(
        'No tiene permisos para ver esta observación',
      );
    }

    return observacion;
  }

  /**
   * Responder una observación (marcarla como resuelta)
   * Solo el remitente del trámite puede responder
   */
  async responder(
    id: string,
    responderDto: ResponderObservacionDto,
    userId: string,
  ) {
    // 1. Obtener la observación con información completa
    const observacion = await this.prisma.observacion.findUnique({
      where: { id_observacion: id },
      include: {
        tramite: {
          include: {
            remitente: {
              select: {
                nombres: true,
                apellidos: true,
                area: true,
              },
            },
            receptor: true,
            documento: {
              include: {
                tipo: true,
              },
            },
          },
        },
      },
    });

    if (!observacion) {
      throw new NotFoundException(`Observación con ID ${id} no encontrada`);
    }

    // 2. Verificar permisos: solo el remitente puede responder
    if (observacion.tramite.id_remitente !== userId) {
      throw new ForbiddenException(
        'Solo el remitente del trámite puede responder observaciones',
      );
    }

    // 3. Verificar que no esté ya resuelta
    if (observacion.resuelta) {
      throw new BadRequestException('Esta observación ya fue resuelta');
    }

    // 4. Validación: si incluye reenvío, debe haber documento
    if (responderDto.incluye_reenvio && !responderDto.id_documento_corregido) {
      throw new BadRequestException(
        'Debe proporcionar un documento corregido cuando incluye_reenvio es true',
      );
    }

    // 5. Guardar estado anterior
    const estadoAnterior = observacion.tramite.estado;

    // 6. Ejecutar en transacción CON TIPADO CORRECTO
    const resultado = await this.prisma.$transaction(async (tx) => {
      // 6.1. Actualizar observación como resuelta
      const observacionResuelta = await tx.observacion.update({
        where: { id_observacion: id },
        data: {
          resuelta: true,
          fecha_resolucion: new Date(),
          resuelto_por: userId,
          respuesta: responderDto.respuesta,
        },
        include: {
          tramite: {
            select: {
              id_tramite: true,
              codigo: true,
              asunto: true,
              estado: true,
            },
          },
          resolutor: {
            select: {
              nombres: true,
              apellidos: true,
              correo: true,
            },
          },
        },
      });

      // 6.2. Registrar en historial
      await tx.historialTramite.create({
        data: {
          id_tramite: observacion.tramite.id_tramite,
          accion: 'OBSERVACION_RESUELTA',
          detalle: `Observación resuelta: ${observacion.tipo} - Respuesta: ${responderDto.respuesta}`,
          estado_anterior: estadoAnterior,
          estado_nuevo: estadoAnterior, // Mantiene el estado
          realizado_por: userId,
          datos_adicionales: {
            id_observacion: id,
            tipo_observacion: observacion.tipo,
            descripcion_observacion: observacion.descripcion,
            respuesta: responderDto.respuesta,
            incluye_reenvio: responderDto.incluye_reenvio || false,
          },
        },
      });

      // 6.3. Variable para el nuevo trámite (TIPADO CORRECTO)
      let nuevoTramite: any = null;

      // 6.4. Si incluye reenvío, crear nuevo trámite
      if (responderDto.incluye_reenvio && responderDto.id_documento_corregido) {
        // Verificar documento corregido
        const documentoCorregido = await tx.documento.findUnique({
          where: { id_documento: responderDto.id_documento_corregido },
          include: { tipo: true },
        });

        if (!documentoCorregido) {
          throw new NotFoundException(
            `Documento corregido con ID ${responderDto.id_documento_corregido} no encontrado`,
          );
        }

        // Calcular número de versión
        const tramiteOriginalId =
          observacion.tramite.id_tramite_original ||
          observacion.tramite.id_tramite;

        const reenviosAnteriores = await tx.tramite.count({
          where: { id_tramite_original: tramiteOriginalId },
        });

        const numeroVersion = reenviosAnteriores + 2;

        // Generar código único
        const year = new Date().getFullYear();
        const count = await tx.tramite.count();
        const codigo = `TRAM-${year}-${String(count + 1).padStart(6, '0')}`;

        // Crear nuevo trámite (reenvío)
        nuevoTramite = await tx.tramite.create({
          data: {
            codigo,
            id_documento: responderDto.id_documento_corregido,
            id_remitente: userId,
            id_area_remitente: observacion.tramite.remitente.area.id_area,
            id_receptor: observacion.tramite.id_receptor,
            asunto: responderDto.asunto_reenvio || observacion.tramite.asunto,
            mensaje: `Documento corregido en respuesta a observación: ${observacion.descripcion}`,
            estado: 'ENVIADO',
            requiere_firma: documentoCorregido.tipo.requiere_firma,
            requiere_respuesta: documentoCorregido.tipo.requiere_respuesta,
            es_reenvio: true,
            id_tramite_original: tramiteOriginalId,
            motivo_reenvio: `Corrección por observación tipo ${observacion.tipo}: ${responderDto.respuesta}`,
            numero_version: numeroVersion,
          },
          include: {
            documento: { include: { tipo: true } },
            remitente: {
              select: {
                id_usuario: true,
                nombres: true,
                apellidos: true,
              },
            },
            receptor: {
              select: {
                id_usuario: true,
                nombres: true,
                apellidos: true,
              },
            },
            tramiteOriginal: {
              select: {
                codigo: true,
                asunto: true,
              },
            },
          },
        });

        // Registrar creación del reenvío
        await tx.historialTramite.create({
          data: {
            id_tramite: nuevoTramite.id_tramite,
            accion: 'REENVIO_POR_OBSERVACION',
            detalle: `Reenvío creado automáticamente al resolver observación ${id}`,
            estado_nuevo: 'ENVIADO',
            realizado_por: userId,
            datos_adicionales: {
              tramite_original: tramiteOriginalId,
              numero_version: numeroVersion,
              id_observacion_origen: id,
            },
          },
        });
      }

      // Retornar ambos valores
      return { observacionResuelta, nuevoTramite };
    });

    // 7. Notificaciones
    await this.notificacionesService.notificarObservacionResuelta(
      observacion.tramite.id_receptor,
      observacion.tramite.id_tramite,
      `${observacion.tramite.remitente.nombres} ${observacion.tramite.remitente.apellidos}`,
    );

    // 8. Si se creó un reenvío, notificar también
    if (resultado.nuevoTramite) {
      await this.notificacionesService.notificarTramiteReenviado(
        resultado.nuevoTramite.id_receptor,
        resultado.nuevoTramite.id_tramite,
        resultado.nuevoTramite.asunto,
        resultado.nuevoTramite.numero_version,
      );
    }

    // 9. WebSocket
    const notificacion = {
      id_observacion: resultado.observacionResuelta.id_observacion,
      tipo: observacion.tipo,
      respuesta: resultado.observacionResuelta.respuesta,
      fecha_resolucion: resultado.observacionResuelta.fecha_resolucion,
      tramite: resultado.observacionResuelta.tramite,
      resolutor: resultado.observacionResuelta.resolutor,
      nuevo_tramite: resultado.nuevoTramite
        ? {
            id_tramite: resultado.nuevoTramite.id_tramite,
            codigo: resultado.nuevoTramite.codigo,
            asunto: resultado.nuevoTramite.asunto,
            numero_version: resultado.nuevoTramite.numero_version,
          }
        : null,
    };

    this.notificacionesGateway.enviarNotificacionResolucion(
      observacion.tramite.id_receptor,
      notificacion,
    );

    // 10. Retornar respuesta estructurada
    return {
      observacion: resultado.observacionResuelta,
      reenvio_creado: resultado.nuevoTramite !== null,
      nuevo_tramite: resultado.nuevoTramite,
    };
  }

  /**
   * Obtener estadísticas de observaciones
   */
  async getStatistics(userId?: string, userRoles?: string[]) {
    let where: any = {};

    // Filtrar por permisos si no es ADMIN
    if (userId && userRoles && !userRoles.includes('ADMIN')) {
      if (userRoles.includes('RESP')) {
        // RESP ve observaciones de trámites enviados por él
        const tramites = await this.prisma.tramite.findMany({
          where: { id_remitente: userId },
          select: { id_tramite: true },
        });
        where.id_tramite = {
          in: tramites.map((t) => t.id_tramite),
        };
      } else if (userRoles.includes('TRAB')) {
        // TRAB ve observaciones que él creó
        where.creado_por = userId;
      }
    }

    const [total, resueltas, pendientes, porTipo] = await Promise.all([
      this.prisma.observacion.count({ where }),
      this.prisma.observacion.count({ where: { ...where, resuelta: true } }),
      this.prisma.observacion.count({ where: { ...where, resuelta: false } }),
      this.prisma.observacion.groupBy({
        by: ['tipo'],
        where,
        _count: true,
      }),
    ]);

    return {
      total,
      resueltas,
      pendientes,
      por_tipo: porTipo.map((item) => ({
        tipo: item.tipo,
        cantidad: item._count,
      })),
    };
  }

  /**
   * Listar observaciones pendientes (sin resolver)
   */
  async findPendientes(userId: string, userRoles: string[]) {
    let where: any = { resuelta: false };

    // Filtrar según permisos
    if (!userRoles.includes('ADMIN')) {
      if (userRoles.includes('RESP')) {
        // RESP ve observaciones de sus trámites
        const tramites = await this.prisma.tramite.findMany({
          where: { id_remitente: userId },
          select: { id_tramite: true },
        });
        where.id_tramite = {
          in: tramites.map((t) => t.id_tramite),
        };
      } else if (userRoles.includes('TRAB')) {
        // TRAB ve sus propias observaciones
        where.creado_por = userId;
      }
    }

    const observaciones = await this.prisma.observacion.findMany({
      where,
      include: {
        tramite: {
          select: {
            codigo: true,
            asunto: true,
            estado: true,
            documento: {
              select: {
                titulo: true,
              },
            },
          },
        },
        creador: {
          select: {
            nombres: true,
            apellidos: true,
          },
        },
      },
      orderBy: {
        fecha_creacion: 'desc',
      },
    });

    return observaciones;
  }
}

// src/modules/respuesta-tramite/respuesta-tramite.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRespuestaTramiteDto } from './dto/create-respuesta-tramite.dto';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { ERoles } from 'src/common/enums/ERoles.enum';

@Injectable()
export class RespuestaTramiteService {
  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
  ) {}

  /**
   * Crear respuesta de conformidad para un trámite
   * Solo el receptor del trámite puede responder
   */
  async crearRespuesta(
    idTramite: string,
    createRespuestaDto: CreateRespuestaTramiteDto,
    userId: string,
    ipAddress: string,
    userAgent: string,
  ) {
    // 1. Verificar que el trámite existe
    const tramite = await this.prisma.tramite.findUnique({
      where: { id_tramite: idTramite },
      include: {
        documento: {
          include: {
            tipo: true,
          },
        },
        receptor: {
          select: {
            nombres: true,
            apellidos: true,
          },
        },
        remitente: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
        respuesta: true, // Verificar si ya existe respuesta
      },
    });

    if (!tramite) {
      throw new NotFoundException(`Trámite con ID ${idTramite} no encontrado`);
    }

    // 2. Solo el receptor puede responder
    if (tramite.id_receptor !== userId) {
      throw new ForbiddenException(
        'Solo el receptor del trámite puede responder',
      );
    }

    // 3. Verificar que el trámite requiere respuesta
    if (!tramite.requiere_respuesta) {
      throw new BadRequestException(
        'Este trámite no requiere respuesta de conformidad',
      );
    }

    // 4. Verificar que el trámite está en estado LEIDO
    if (tramite.estado !== 'LEIDO') {
      throw new BadRequestException(
        'El trámite debe estar en estado LEIDO para poder responder',
      );
    }

    // 5. Verificar que no haya sido respondido previamente
    if (tramite.respuesta) {
      throw new BadRequestException('Este trámite ya fue respondido');
    }

    // 6. Validar que acepta conformidad
    if (!createRespuestaDto.acepta_conformidad) {
      throw new BadRequestException(
        'Debe confirmar que está conforme con el documento para continuar',
      );
    }

    // 7. Extraer información del navegador
    const navegador = this.extractBrowser(userAgent);
    const dispositivo = this.extractDevice(userAgent);

    // 8. Crear la respuesta en una transacción
    const result = await this.prisma.$transaction(async (tx) => {
      // Crear registro de respuesta
      const respuesta = await tx.respuestaTramite.create({
        data: {
          id_tramite: idTramite,
          texto_respuesta: 'Conforme', // Texto estándar fijo
          esta_conforme: true, // Siempre true cuando se confirma
          ip_address: ipAddress,
          navegador,
          dispositivo,
        },
      });

      // Actualizar estado del trámite a RESPONDIDO
      const tramiteActualizado = await tx.tramite.update({
        where: { id_tramite: idTramite },
        data: {
          estado: 'RESPONDIDO',
        },
        include: {
          documento: {
            include: {
              tipo: true,
            },
          },
          remitente: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
            },
          },
          receptor: {
            select: {
              nombres: true,
              apellidos: true,
            },
          },
          respuesta: true,
        },
      });

      // Registrar en historial
      await tx.historialTramite.create({
        data: {
          id_tramite: idTramite,
          accion: 'RESPUESTA',
          detalle: 'Conformidad confirmada por el trabajador',
          estado_anterior: 'LEIDO',
          estado_nuevo: 'RESPONDIDO',
          realizado_por: userId,
          ip_address: ipAddress,
          datos_adicionales: {
            navegador,
            dispositivo,
            confirmacion_automatica: true,
          },
        },
      });

      return { respuesta, tramiteActualizado };
    });

    // Notificar al remitente
    await this.notificacionesService.create({
      id_usuario: tramite.remitente.id_usuario,
      id_tramite: idTramite,
      tipo: 'RESPUESTA_RECIBIDA',
      titulo: 'Confirmación de conformidad recibida',
      mensaje: `${tramite.receptor.nombres} ${tramite.receptor.apellidos} esta de acuerdo con "${tramite.asunto}"`,
    });

    return result;
  }

  /**
   * Obtener respuesta de un trámite por ID
   */
  async obtenerRespuesta(
    idTramite: string,
    userId: string,
    userRoles: string[],
  ) {
    // Verificar que el trámite existe
    const tramite = await this.prisma.tramite.findUnique({
      where: { id_tramite: idTramite },
    });

    if (!tramite) {
      throw new NotFoundException(`Trámite con ID ${idTramite} no encontrado`);
    }

    // Verificar permisos: ADMIN, remitente o receptor
    const tieneAcceso =
      userRoles.includes(ERoles.ADMIN) ||
      tramite.id_remitente === userId ||
      tramite.id_receptor === userId;

    if (!tieneAcceso) {
      throw new ForbiddenException('No tiene permisos para ver esta respuesta');
    }

    // Obtener la respuesta
    const respuesta = await this.prisma.respuestaTramite.findUnique({
      where: { id_tramite: idTramite },
      include: {
        tramite: {
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
                nombres: true,
                apellidos: true,
              },
            },
          },
        },
      },
    });

    if (!respuesta) {
      throw new NotFoundException('No se encontró respuesta para este trámite');
    }

    return respuesta;
  }

  /**
   * Obtener estadísticas de respuestas
   * Solo para ADMIN o remitente del trámite
   */
  async obtenerEstadisticas(filtros?: {
    id_remitente?: string;
    id_area?: string;
    fecha_inicio?: Date;
    fecha_fin?: Date;
  }) {
    const where: any = {};

    // Filtrar por remitente si se especifica
    if (filtros?.id_remitente) {
      where.tramite = {
        id_remitente: filtros.id_remitente,
      };
    }

    // Filtrar por área si se especifica
    if (filtros?.id_area) {
      where.tramite = {
        ...where.tramite,
        id_area_remitente: filtros.id_area,
      };
    }

    // Filtrar por rango de fechas
    if (filtros?.fecha_inicio || filtros?.fecha_fin) {
      where.fecha_respuesta = {};
      if (filtros.fecha_inicio) {
        where.fecha_respuesta.gte = filtros.fecha_inicio;
      }
      if (filtros.fecha_fin) {
        where.fecha_respuesta.lte = filtros.fecha_fin;
      }
    }

    // Contar respuestas conformes y no conformes
    const [totalRespuestas, conformes, noConformes] = await Promise.all([
      this.prisma.respuestaTramite.count({ where }),
      this.prisma.respuestaTramite.count({
        where: { ...where, esta_conforme: true },
      }),
      this.prisma.respuestaTramite.count({
        where: { ...where, esta_conforme: false },
      }),
    ]);

    return {
      total: totalRespuestas,
      conformes,
      noConformes,
      porcentajeConformes:
        totalRespuestas > 0 ? (conformes / totalRespuestas) * 100 : 0,
      porcentajeNoConformes:
        totalRespuestas > 0 ? (noConformes / totalRespuestas) * 100 : 0,
    };
  }

  /**
   * Utilidad: Extraer navegador del User-Agent
   */
  private extractBrowser(userAgent: string): string {
    if (!userAgent) return 'Desconocido';

    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';

    return 'Otro';
  }

  /**
   * Utilidad: Extraer dispositivo del User-Agent
   */
  private extractDevice(userAgent: string): string {
    if (!userAgent) return 'Desconocido';

    if (userAgent.includes('Mobile')) return 'Móvil';
    if (userAgent.includes('Tablet')) return 'Tablet';

    return 'Escritorio';
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFirmaElectronicaDto } from './dto/create-firma-electronica.dto';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { ERoles } from 'src/common/enums/ERoles.enum';

@Injectable()
export class FirmaElectronicaService {
  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
  ) {}

  /**
   * Crear firma electrónica para un trámite
   * Solo el receptor del trámite puede firmar
   */
  async firmar(
    idTramite: string,
    createFirmaDto: CreateFirmaElectronicaDto,
    userId: string,
    ipAddress: string,
    userAgent: string,
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
        receptor: {
          select: {
            nombres: true,
            apellidos: true,
          },
        },
        firma: true, // Verificar si ya existe firma
      },
    });

    if (!tramite) {
      throw new NotFoundException(`Trámite con ID ${idTramite} no encontrado`);
    }

    // Solo el receptor puede firmar
    if (tramite.id_receptor !== userId) {
      throw new ForbiddenException(
        'Solo el receptor del trámite puede firmar el documento',
      );
    }

    // Verificar que el trámite requiere firma
    if (!tramite.requiere_firma) {
      throw new BadRequestException(
        'Este trámite no requiere firma electrónica',
      );
    }

    // Verificar que el trámite está en estado LEIDO
    if (tramite.estado !== 'LEIDO') {
      throw new BadRequestException(
        'El trámite debe estar en estado LEIDO para poder firmarlo',
      );
    }

    // Verificar que no haya sido firmado previamente
    if (tramite.firma) {
      throw new BadRequestException('Este trámite ya ha sido firmado');
    }

    // Verificar que acepta los términos
    if (!createFirmaDto.acepta_terminos) {
      throw new BadRequestException(
        'Debe aceptar los términos y condiciones para firmar',
      );
    }

    // Extraer información del navegador del User-Agent
    const navegador = this.extractBrowser(userAgent);
    const dispositivo = this.extractDevice(userAgent);

    // Crear la firma electrónica en una transacción
    const result = await this.prisma.$transaction(async (tx) => {
      // Crear registro de firma
      const firma = await tx.firmaElectronica.create({
        data: {
          id_tramite: idTramite,
          acepta_terminos: createFirmaDto.acepta_terminos,
          ip_address: ipAddress,
          navegador,
          dispositivo,
        },
      });

      // Actualizar estado del trámite a FIRMADO
      const tramiteActualizado = await tx.tramite.update({
        where: { id_tramite: idTramite },
        data: {
          estado: 'FIRMADO',
          fecha_firmado: new Date(),
        },
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
              correo: true,
            },
          },
          receptor: {
            select: {
              nombres: true,
              apellidos: true,
              correo: true,
            },
          },
        },
      });

      // Registrar en historial
      await tx.historialTramite.create({
        data: {
          id_tramite: idTramite,
          accion: 'FIRMA',
          detalle: 'Documento firmado electrónicamente',
          estado_anterior: 'LEIDO',
          estado_nuevo: 'FIRMADO',
          realizado_por: userId,
          ip_address: ipAddress,
          datos_adicionales: {
            navegador,
            dispositivo,
            acepta_terminos: true,
          },
        },
      });

      return { firma, tramite: tramiteActualizado };
    });

    // Notificar al remitente que el documento fue firmado
    await this.notificacionesService.notificarDocumentoFirmado(
      tramite.id_remitente,
      idTramite,
      `${tramite.receptor.nombres} ${tramite.receptor.apellidos}`,
      tramite.asunto,
    );

    return result;
  }

  /**
   * Obtener firma electrónica de un trámite
   */
  async findByTramite(idTramite: string, userId: string, userRoles: string[]) {
    const tramite = await this.prisma.tramite.findUnique({
      where: { id_tramite: idTramite },
      include: {
        firma: true,
      },
    });

    if (!tramite) {
      throw new NotFoundException(`Trámite con ID ${idTramite} no encontrado`);
    }

    // Verificar permisos - solo ADMIN, remitente o receptor pueden ver la firma
    const tieneAcceso =
      userRoles.includes(ERoles.ADMIN) ||
      tramite.id_remitente === userId ||
      tramite.id_receptor === userId;

    if (!tieneAcceso) {
      throw new ForbiddenException(
        'No tiene permisos para ver la firma de este trámite',
      );
    }

    if (!tramite.firma) {
      throw new NotFoundException(
        `El trámite ${idTramite} no tiene firma electrónica`,
      );
    }

    return tramite.firma;
  }

  /**
   * Verificar si un trámite ha sido firmado
   */
  async verificarFirma(idTramite: string) {
    const tramite = await this.prisma.tramite.findUnique({
      where: { id_tramite: idTramite },
      include: {
        firma: true,
        documento: {
          include: {
            tipo: true,
          },
        },
        receptor: {
          select: {
            nombres: true,
            apellidos: true,
            dni: true,
            correo: true,
          },
        },
      },
    });

    if (!tramite) {
      throw new NotFoundException(`Trámite con ID ${idTramite} no encontrado`);
    }

    return {
      firmado: !!tramite.firma,
      requiere_firma: tramite.requiere_firma,
      estado: tramite.estado,
      firma: tramite.firma
        ? {
            fecha_firma: tramite.firma.fecha_firma,
            ip_address: tramite.firma.ip_address,
            navegador: tramite.firma.navegador,
            dispositivo: tramite.firma.dispositivo,
          }
        : null,
      documento: {
        titulo: tramite.documento.titulo,
        tipo: tramite.documento.tipo.nombre,
      },
      receptor: tramite.receptor,
    };
  }

  /**
   * Obtener estadísticas de firmas electrónicas
   */
  async getStatistics() {
    const [
      totalFirmas,
      firmasPorDia,
      firmasPorNavegador,
      tramitesPendientesFirma,
    ] = await Promise.all([
      // Total de firmas
      this.prisma.firmaElectronica.count(),

      // Firmas de los últimos 30 días
      this.prisma.firmaElectronica.groupBy({
        by: ['fecha_firma'],
        _count: true,
        where: {
          fecha_firma: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: {
          fecha_firma: 'asc',
        },
      }),

      // Firmas por navegador
      this.prisma.firmaElectronica.groupBy({
        by: ['navegador'],
        _count: true,
        orderBy: {
          _count: {
            navegador: 'desc',
          },
        },
      }),

      // Trámites que requieren firma pero no han sido firmados
      this.prisma.tramite.count({
        where: {
          requiere_firma: true,
          estado: {
            in: ['ENVIADO', 'ABIERTO', 'LEIDO'],
          },
        },
      }),
    ]);

    return {
      total_firmas: totalFirmas,
      tramites_pendientes_firma: tramitesPendientesFirma,
      firmas_ultimos_30_dias: firmasPorDia.length,
      por_navegador: firmasPorNavegador.map((item) => ({
        navegador: item.navegador || 'Desconocido',
        cantidad: item._count,
      })),
    };
  }

  /**
   * Extraer nombre del navegador del User-Agent
   */
  private extractBrowser(userAgent: string): string {
    if (!userAgent) return 'Desconocido';

    const ua = userAgent.toLowerCase();

    if (ua.includes('edg')) return 'Microsoft Edge';
    if (ua.includes('chrome') && !ua.includes('edg')) return 'Google Chrome';
    if (ua.includes('firefox')) return 'Mozilla Firefox';
    if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
    if (ua.includes('opera') || ua.includes('opr')) return 'Opera';

    return 'Otro';
  }

  /**
   * Extraer información del dispositivo del User-Agent
   */
  private extractDevice(userAgent: string): string {
    if (!userAgent) return 'Desconocido';

    const ua = userAgent.toLowerCase();

    // Detectar sistema operativo
    let os = 'Desconocido';
    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('mac')) os = 'macOS';
    else if (ua.includes('linux')) os = 'Linux';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

    // Detectar tipo de dispositivo
    let deviceType = 'Desktop';
    if (ua.includes('mobile')) deviceType = 'Mobile';
    else if (ua.includes('tablet') || ua.includes('ipad'))
      deviceType = 'Tablet';

    return `${deviceType} - ${os}`;
  }
}

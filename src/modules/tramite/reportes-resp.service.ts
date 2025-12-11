import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ERoles } from 'src/common/enums/ERoles.enum';
import { ETramitStatus } from 'src/common/enums/ETramitStatus.enum';

export interface FiltrosReporte {
  fecha_inicio?: string; // YYYY-MM-DD
  fecha_fin?: string; // YYYY-MM-DD
  id_tipo_documento?: string;
  id_area?: string; // Para ADMIN que quiere ver reportes de otras áreas
}

export interface ReportePersonalizado {
  periodo: {
    fecha_inicio: string;
    fecha_fin: string;
  };
  tipo_documento?: {
    id_tipo: string;
    codigo: string;
    nombre: string;
  };
  area?: {
    id_area: string;
    nombre: string;
  };
  resumen: {
    total_enviados: number;
    total_entregados: number; // ABIERTO + LEIDO + FIRMADO + RESPONDIDO
    total_pendientes: number; // ENVIADO
    total_abiertos: number;
    total_leidos: number;
    total_firmados: number;
    total_respondidos: number;
    total_anulados: number;
    porcentaje_entregados: number;
    porcentaje_pendientes: number;
  };
  metricas_firma: {
    requieren_firma: number;
    firmados: number;
    pendientes_firma: number;
    porcentaje_firmados: number;
  };
  metricas_respuesta: {
    requieren_respuesta: number;
    respondidos: number;
    pendientes_respuesta: number;
    porcentaje_respondidos: number;
  };
  tiempos_promedio: {
    envio_a_apertura_horas: number;
    envio_a_lectura_horas: number;
    envio_a_firma_horas: number;
    envio_a_respuesta_horas: number;
  };
  distribucion_por_dia: Array<{
    fecha: string;
    enviados: number;
    abiertos: number;
    leidos: number;
    firmados: number;
  }>;
  trabajadores_top: Array<{
    id_usuario: string;
    nombre_completo: string;
    total_recibidos: number;
    completados: number;
    porcentaje_completado: number;
  }>;
}

@Injectable()
export class ReportesRespService {
  constructor(private prisma: PrismaService) {}

  private async getAreaResponsable(userId: string, userRoles: string[]) {
    if (userRoles.includes(ERoles.ADMIN)) {
      return null; // Admin ve todo
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id_usuario: userId },
      select: { id_area: true },
    });

    return usuario?.id_area;
  }

  async generarReportePersonalizado(
    userId: string,
    userRoles: string[],
    filtros: FiltrosReporte,
  ): Promise<ReportePersonalizado> {
    const idAreaUsuario = await this.getAreaResponsable(userId, userRoles);

    // Construir filtros base
    const where: any = {};

    // Filtro de área
    if (filtros.id_area && userRoles.includes(ERoles.ADMIN)) {
      where.id_area_remitente = filtros.id_area;
    } else if (idAreaUsuario) {
      where.id_area_remitente = idAreaUsuario;
    }

    // Filtro de fechas
    if (filtros.fecha_inicio || filtros.fecha_fin) {
      where.fecha_envio = {};

      if (filtros.fecha_inicio) {
        const inicio = new Date(filtros.fecha_inicio);
        inicio.setHours(0, 0, 0, 0);
        where.fecha_envio.gte = inicio;
      }

      if (filtros.fecha_fin) {
        const fin = new Date(filtros.fecha_fin);
        fin.setHours(23, 59, 59, 999);
        where.fecha_envio.lte = fin;
      }
    }

    // Filtro de tipo de documento
    if (filtros.id_tipo_documento) {
      where.documento = {
        id_tipo: filtros.id_tipo_documento,
      };
    }

    // === OBTENER DATOS ===
    const [
      tramites,
      tipoDocumento,
      area,
    ] = await Promise.all([
      this.prisma.tramite.findMany({
        where,
        include: {
          documento: {
            include: {
              tipo: true,
            },
          },
          receptor: {
            select: {
              id_usuario: true,
              nombres: true,
              apellidos: true,
            },
          },
          firma: true,
          respuesta: true,
        },
        orderBy: {
          fecha_envio: 'asc',
        },
      }),
      // Obtener info del tipo de documento si está filtrado
      filtros.id_tipo_documento
        ? this.prisma.tipoDocumento.findUnique({
          where: { id_tipo: filtros.id_tipo_documento },
        })
        : null,
      // Obtener info del área si está filtrada
      filtros.id_area
        ? this.prisma.area.findUnique({
          where: { id_area: filtros.id_area },
        })
        : null,
    ]);

    // === CALCULAR RESUMEN ===
    const totalEnviados = tramites.length;
    const totalPendientes = tramites.filter((t) => t.estado === ETramitStatus.ENVIADO).length;
    const totalAbiertos = tramites.filter((t) => t.estado === ETramitStatus.ABIERTO).length;
    const totalLeidos = tramites.filter((t) => t.estado === ETramitStatus.LEIDO).length;
    const totalFirmados = tramites.filter((t) => t.estado === ETramitStatus.FIRMADO).length;
    const totalRespondidos = tramites.filter((t) => t.estado === ETramitStatus.RESPONDIDO).length;
    const totalAnulados = tramites.filter((t) => t.estado === ETramitStatus.ANULADO).length;

    const totalEntregados = totalAbiertos + totalLeidos + totalFirmados + totalRespondidos;

    const porcentajeEntregados = totalEnviados > 0 ? (totalEntregados / totalEnviados) * 100 : 0;
    const porcentajePendientes = totalEnviados > 0 ? (totalPendientes / totalEnviados) * 100 : 0;

    // === MÉTRICAS DE FIRMA ===
    const tramitesConFirma = tramites.filter((t) => t.requiere_firma);
    const requierenFirma = tramitesConFirma.length;
    const firmados = tramitesConFirma.filter((t) => t.estado === ETramitStatus.FIRMADO).length;
    const pendientesFirma = requierenFirma - firmados;
    const porcentajeFirmados = requierenFirma > 0 ? (firmados / requierenFirma) * 100 : 0;

    // === MÉTRICAS DE RESPUESTA ===
    const tramitesConRespuesta = tramites.filter((t) => t.requiere_respuesta);
    const requierenRespuesta = tramitesConRespuesta.length;
    const respondidos = tramitesConRespuesta.filter(
      (t) => t.estado === ETramitStatus.RESPONDIDO,
    ).length;
    const pendientesRespuesta = requierenRespuesta - respondidos;
    const porcentajeRespondidos =
      requierenRespuesta > 0 ? (respondidos / requierenRespuesta) * 100 : 0;

    // === TIEMPOS PROMEDIO ===
    const calcularPromedioHoras = (tramitesFiltrados: any[], campoFecha: string) => {
      const tiempos = tramitesFiltrados
        .filter((t) => t[campoFecha] != null)
        .map((t) => {
          const envio = new Date(t.fecha_envio).getTime();
          const evento = new Date(t[campoFecha]).getTime();
          return (evento - envio) / (1000 * 60 * 60); // horas
        });

      if (tiempos.length === 0) return 0;
      return tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
    };

    const tiemposPromedio = {
      envio_a_apertura_horas: calcularPromedioHoras(tramites, 'fecha_abierto'),
      envio_a_lectura_horas: calcularPromedioHoras(tramites, 'fecha_leido'),
      envio_a_firma_horas: calcularPromedioHoras(
        tramites.filter((t) => t.requiere_firma),
        'fecha_firmado',
      ),
      envio_a_respuesta_horas: calcularPromedioHoras(
        tramites.filter((t) => t.respuesta != null),
        'fecha_leido', // Aproximación
      ),
    };

    // === DISTRIBUCIÓN POR DÍA ===
    const distribucionMap = new Map<string, any>();

    tramites.forEach((t) => {
      const fecha = this.formatearFechaSinHora(t.fecha_envio);

      if (!distribucionMap.has(fecha)) {
        distribucionMap.set(fecha, {
          fecha,
          enviados: 0,
          abiertos: 0,
          leidos: 0,
          firmados: 0,
        });
      }

      const dia = distribucionMap.get(fecha)!;
      dia.enviados++;

      if (t.estado === ETramitStatus.ABIERTO || t.fecha_abierto) dia.abiertos++;
      if (t.estado === ETramitStatus.LEIDO || t.fecha_leido) dia.leidos++;
      if (t.estado === ETramitStatus.FIRMADO || t.fecha_firmado) dia.firmados++;
    });

    const distribucionPorDia = Array.from(distribucionMap.values()).sort((a, b) =>
      a.fecha.localeCompare(b.fecha),
    );

    // === TRABAJADORES TOP ===
    const trabajadoresMap = new Map<string, any>();

    tramites.forEach((t) => {
      const idReceptor = t.receptor.id_usuario;

      if (!trabajadoresMap.has(idReceptor)) {
        trabajadoresMap.set(idReceptor, {
          id_usuario: idReceptor,
          nombre_completo: `${t.receptor.nombres} ${t.receptor.apellidos}`,
          total_recibidos: 0,
          completados: 0,
        });
      }

      const trabajador = trabajadoresMap.get(idReceptor)!;
      trabajador.total_recibidos++;

      if (
        t.estado === ETramitStatus.FIRMADO ||
        t.estado === ETramitStatus.RESPONDIDO ||
        t.estado === ETramitStatus.LEIDO
      ) {
        trabajador.completados++;
      }
    });

    const trabajadoresTop = Array.from(trabajadoresMap.values())
      .map((t) => ({
        ...t,
        porcentaje_completado:
          t.total_recibidos > 0 ? (t.completados / t.total_recibidos) * 100 : 0,
      }))
      .sort((a, b) => b.porcentaje_completado - a.porcentaje_completado)
      .slice(0, 10);

    // === CONSTRUIR RESPUESTA ===
    return {
      periodo: {
        fecha_inicio: filtros.fecha_inicio || 'N/A',
        fecha_fin: filtros.fecha_fin || 'N/A',
      },
      tipo_documento: tipoDocumento
        ? {
          id_tipo: tipoDocumento.id_tipo,
          codigo: tipoDocumento.codigo,
          nombre: tipoDocumento.nombre,
        }
        : undefined,
      area: area
        ? {
          id_area: area.id_area,
          nombre: area.nombre,
        }
        : undefined,
      resumen: {
        total_enviados: totalEnviados,
        total_entregados: totalEntregados,
        total_pendientes: totalPendientes,
        total_abiertos: totalAbiertos,
        total_leidos: totalLeidos,
        total_firmados: totalFirmados,
        total_respondidos: totalRespondidos,
        total_anulados: totalAnulados,
        porcentaje_entregados: parseFloat(porcentajeEntregados.toFixed(2)),
        porcentaje_pendientes: parseFloat(porcentajePendientes.toFixed(2)),
      },
      metricas_firma: {
        requieren_firma: requierenFirma,
        firmados,
        pendientes_firma: pendientesFirma,
        porcentaje_firmados: parseFloat(porcentajeFirmados.toFixed(2)),
      },
      metricas_respuesta: {
        requieren_respuesta: requierenRespuesta,
        respondidos,
        pendientes_respuesta: pendientesRespuesta,
        porcentaje_respondidos: parseFloat(porcentajeRespondidos.toFixed(2)),
      },
      tiempos_promedio: {
        envio_a_apertura_horas: parseFloat(tiemposPromedio.envio_a_apertura_horas.toFixed(2)),
        envio_a_lectura_horas: parseFloat(tiemposPromedio.envio_a_lectura_horas.toFixed(2)),
        envio_a_firma_horas: parseFloat(tiemposPromedio.envio_a_firma_horas.toFixed(2)),
        envio_a_respuesta_horas: parseFloat(tiemposPromedio.envio_a_respuesta_horas.toFixed(2)),
      },
      distribucion_por_dia: distribucionPorDia,
      trabajadores_top: trabajadoresTop,
    };
  }

  private formatearFechaSinHora(fecha: Date): string {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
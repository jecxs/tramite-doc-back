import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ERoles } from 'src/common/enums/ERoles.enum';
import { ETramitStatus } from 'src/common/enums/ETramitStatus.enum';

export interface FiltrosReporte {
  fecha_inicio?: string;
  fecha_fin?: string;
  id_tipo_documento?: string;
  id_area?: string;
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
    total_entregados: number;
    total_completados: number;
    total_pendientes: number;
    total_abiertos: number;
    total_leidos: number;
    total_firmados: number;
    total_respondidos: number;
    total_anulados: number;
    porcentaje_entregados: number;
    porcentaje_completados: number;
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
    pendientes: number;
    porcentaje_completado: number;
  }>;
}

@Injectable()
export class ReportesRespService {
  constructor(private prisma: PrismaService) {}

  // ==================== HELPERS DE ZONA HORARIA ====================

  private readonly TIMEZONE = 'America/Lima';
  private readonly OFFSET_LIMA_HORAS = -5; // UTC-5

  /**
   * Convierte una fecha UTC a formato YYYY-MM-DD en zona horaria de Lima
   */
  private convertirAZonaHorariaPeru(fechaUTC: Date): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    // 'en-CA' retorna formato YYYY-MM-DD directamente
    return formatter.format(fechaUTC);
  }

  /**
   * Crea un Date en zona horaria de Lima a partir de un string YYYY-MM-DD
   * Retorna el Date en UTC que representa ese momento en Lima
   */
  private crearFechaLima(
    fechaStr: string,
    hora: number,
    minuto: number,
    segundo: number,
    milisegundo: number,
  ): Date {
    // Parsear la fecha string
    const [year, month, day] = fechaStr.split('-').map(Number);

    // Crear fecha en UTC
    const fechaUTC = new Date(
      Date.UTC(year, month - 1, day, hora, minuto, segundo, milisegundo),
    );

    // Ajustar por el offset de Lima (UTC-5)
    // Si queremos las 00:00:00 en Lima, necesitamos sumar 5 horas en UTC
    const offsetLimaMinutos = this.OFFSET_LIMA_HORAS * 60;
    fechaUTC.setMinutes(fechaUTC.getMinutes() - offsetLimaMinutos);

    return fechaUTC;
  }
  /**
   * Verifica si un trámite está realmente completado según sus requisitos
   */
  private verificarTramiteCompletado(tramite: any): boolean {
    // Si está anulado, no cuenta como completado
    if (tramite.estado === ETramitStatus.ANULADO) {
      return false;
    }

    // Si requiere firma, debe estar FIRMADO
    if (tramite.requiere_firma) {
      return tramite.estado === ETramitStatus.FIRMADO;
    }

    // Si requiere respuesta, debe estar RESPONDIDO
    if (tramite.requiere_respuesta) {
      return tramite.estado === ETramitStatus.RESPONDIDO;
    }

    // Si solo requiere lectura (memo, notificación), debe estar al menos LEIDO
    return (
      tramite.estado === ETramitStatus.LEIDO ||
      tramite.estado === ETramitStatus.FIRMADO ||
      tramite.estado === ETramitStatus.RESPONDIDO
    );
  }

  // ==================== LÓGICA DE NEGOCIO ====================

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
    const isAdmin = userRoles.includes(ERoles.ADMIN);

    // Construir filtros base
    const where: any = {};

    // 🔥 FILTRO POR ÁREA (NO POR REMITENTE)
    // Los responsables ven todos los trámites de su área
    if (isAdmin) {
      // ADMIN: Puede filtrar por área específica o ver todo
      if (filtros.id_area) {
        where.id_area_remitente = filtros.id_area;
      }
      // Si no especifica área, ve todo (no agregar filtro)
    } else {
      // RESPONSABLE: Ve todos los trámites de su área
      if (idAreaUsuario) {
        where.id_area_remitente = idAreaUsuario;
      }
    }

    // 🔥 FILTRO DE FECHAS CON ZONA HORARIA DE LIMA
    if (filtros.fecha_inicio) {
      where.fecha_envio = {};

      // Fecha inicio: 00:00:00 en Lima
      const fechaInicio = this.crearFechaLima(filtros.fecha_inicio, 0, 0, 0, 0);

      // Fecha fin: 23:59:59.999 en Lima
      const fechaFinStr = filtros.fecha_fin || filtros.fecha_inicio;
      const fechaFin = this.crearFechaLima(fechaFinStr, 23, 59, 59, 999);

      where.fecha_envio = {
        gte: fechaInicio,
        lte: fechaFin,
      };

      console.log('🔍 [REPORTES] Filtro de fechas aplicado:', {
        fecha_inicio_input: filtros.fecha_inicio,
        fecha_fin_input: fechaFinStr,
        fecha_inicio_utc: fechaInicio.toISOString(),
        fecha_fin_utc: fechaFin.toISOString(),
      });
    }

    // Filtro de tipo de documento
    if (filtros.id_tipo_documento) {
      where.documento = {
        id_tipo: filtros.id_tipo_documento,
      };
    }

    console.log(
      '🔍 [REPORTES] WHERE clause completo:',
      JSON.stringify(where, null, 2),
    );

    // === OBTENER TRÁMITES ===
    const tramites = await this.prisma.tramite.findMany({
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
            correo: true,
          },
        },
        respuesta: true,
      },
      orderBy: {
        fecha_envio: 'asc',
      },
    });

    console.log(`✅ [REPORTES] Trámites encontrados: ${tramites.length}`);

    if (tramites.length > 0) {
      console.log(
        '📋 [REPORTES] Primeros 3 trámites:',
        tramites.slice(0, 3).map((t) => ({
          codigo: t.codigo,
          fecha_envio: t.fecha_envio.toISOString(),
          fecha_envio_lima: this.convertirAZonaHorariaPeru(t.fecha_envio),
        })),
      );
    }

    // === OBTENER INFORMACIÓN ADICIONAL ===
    let tipoDocumento: {
      id_tipo: string;
      codigo: string;
      nombre: string;
      descripcion: string | null;
      requiere_firma: boolean;
      requiere_respuesta: boolean;
    } | null = null;

    if (filtros.id_tipo_documento) {
      tipoDocumento = await this.prisma.tipoDocumento.findUnique({
        where: { id_tipo: filtros.id_tipo_documento },
      });
    }

    let area: {
      id_area: string;
      nombre: string;
      activo: boolean;
    } | null = null;

    if (filtros.id_area && isAdmin) {
      area = await this.prisma.area.findUnique({
        where: { id_area: filtros.id_area },
      });
    } else if (idAreaUsuario) {
      area = await this.prisma.area.findUnique({
        where: { id_area: idAreaUsuario },
      });
    }

    const totalEnviados = tramites.length;

    // Contar por estados
    const totalPendientes = tramites.filter(
      (t) => t.estado === ETramitStatus.ENVIADO,
    ).length;
    const totalAbiertos = tramites.filter(
      (t) => t.estado === ETramitStatus.ABIERTO,
    ).length;
    const totalLeidos = tramites.filter(
      (t) => t.estado === ETramitStatus.LEIDO,
    ).length;
    const totalFirmados = tramites.filter(
      (t) => t.estado === ETramitStatus.FIRMADO,
    ).length;
    const totalRespondidos = tramites.filter(
      (t) => t.estado === ETramitStatus.RESPONDIDO,
    ).length;
    const totalAnulados = tramites.filter(
      (t) => t.estado === ETramitStatus.ANULADO,
    ).length;

    // CORRECCIÓN: Calcular "completados" basándose en los requisitos reales
    const totalCompletados = tramites.filter((t) =>
      this.verificarTramiteCompletado(t),
    ).length;

    // "Entregados" significa que ya llegó al trabajador (abierto o más)
    const totalEntregados = tramites.filter(
      (t) =>
        t.estado !== ETramitStatus.ENVIADO &&
        t.estado !== ETramitStatus.ANULADO,
    ).length;

    const porcentajeCompletados =
      totalEnviados > 0 ? (totalCompletados / totalEnviados) * 100 : 0;
    const porcentajeEntregados =
      totalEnviados > 0 ? (totalEntregados / totalEnviados) * 100 : 0;
    const porcentajePendientes =
      totalEnviados > 0 ? (totalPendientes / totalEnviados) * 100 : 0;

    // === MÉTRICAS DE FIRMA ===
    const tramitesConFirma = tramites.filter((t) => t.requiere_firma);
    const requierenFirma = tramitesConFirma.length;
    const firmados = tramitesConFirma.filter(
      (t) => t.estado === ETramitStatus.FIRMADO,
    ).length;
    const pendientesFirma = requierenFirma - firmados;
    const porcentajeFirmados =
      requierenFirma > 0 ? (firmados / requierenFirma) * 100 : 0;

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
    const calcularPromedioHoras = (
      tramitesFiltrados: any[],
      campoFecha: string,
    ) => {
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

    // === DISTRIBUCIÓN POR DÍA (usando zona horaria de Lima) ===
    const distribucionMap = new Map<string, any>();

    tramites.forEach((t) => {
      const fecha = this.convertirAZonaHorariaPeru(t.fecha_envio);

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

    const distribucionPorDia = Array.from(distribucionMap.values()).sort(
      (a, b) => a.fecha.localeCompare(b.fecha),
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
          pendientes: 0,
        });
      }

      const trabajador = trabajadoresMap.get(idReceptor)!;
      trabajador.total_recibidos++;

      // LÓGICA CORRECTA: Verificar si está realmente completado según lo que requiere
      const estaCompletado = this.verificarTramiteCompletado(t);

      if (estaCompletado) {
        trabajador.completados++;
      } else {
        // Solo contabilizar como pendiente si no está anulado
        if (t.estado !== ETramitStatus.ANULADO) {
          trabajador.pendientes++;
        }
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
        fecha_fin: filtros.fecha_fin || filtros.fecha_inicio || 'N/A',
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
        total_entregados: totalEntregados, // Documentos que ya llegaron al trabajador
        total_completados: totalCompletados, // NUEVO: Documentos que cumplieron su requisito final
        total_pendientes: totalPendientes, // Aún no han sido abiertos
        total_abiertos: totalAbiertos,
        total_leidos: totalLeidos,
        total_firmados: totalFirmados,
        total_respondidos: totalRespondidos,
        total_anulados: totalAnulados,
        porcentaje_entregados: parseFloat(porcentajeEntregados.toFixed(2)),
        porcentaje_completados: parseFloat(porcentajeCompletados.toFixed(2)), // NUEVO
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
        envio_a_apertura_horas: parseFloat(
          tiemposPromedio.envio_a_apertura_horas.toFixed(2),
        ),
        envio_a_lectura_horas: parseFloat(
          tiemposPromedio.envio_a_lectura_horas.toFixed(2),
        ),
        envio_a_firma_horas: parseFloat(
          tiemposPromedio.envio_a_firma_horas.toFixed(2),
        ),
        envio_a_respuesta_horas: parseFloat(
          tiemposPromedio.envio_a_respuesta_horas.toFixed(2),
        ),
      },
      distribucion_por_dia: distribucionPorDia,
      trabajadores_top: trabajadoresTop,
    };
  }
}

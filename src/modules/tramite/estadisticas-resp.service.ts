// src/modules/tramite/estadisticas-resp.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ERoles } from 'src/common/enums/ERoles.enum';
import { ETramitStatus } from 'src/common/enums/ETramitStatus.enum';

@Injectable()
export class EstadisticasRespService {
  constructor(private prisma: PrismaService) {}

  /**
   * Helper para obtener el área del responsable
   */
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
  private readonly TIMEZONE = 'America/Lima';
  private convertirAZonaHorariaPeru(fecha: Date): string {
    // Convertir a zona horaria de Lima/Perú (UTC-5)
    const fechaPeru = new Date(fecha.toLocaleString('en-US', {
      timeZone: this.TIMEZONE
    }));

    // Obtener componentes de fecha
    const year = fechaPeru.getFullYear();
    const month = String(fechaPeru.getMonth() + 1).padStart(2, '0');
    const day = String(fechaPeru.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private obtenerFechaActualPeru(): Date {
    return new Date(new Date().toLocaleString('en-US', {
      timeZone: this.TIMEZONE
    }));
  }


  private crearRangoFechas(diasAtras: number): { inicio: Date; fin: Date } {
    const hoy = this.obtenerFechaActualPeru();
    hoy.setHours(23, 59, 59, 999);

    const inicio = this.obtenerFechaActualPeru();
    inicio.setDate(inicio.getDate() - diasAtras);
    inicio.setHours(0, 0, 0, 0);

    return { inicio, fin: hoy };
  }

  /**
   * 1. ESTADÍSTICAS GENERALES
   * Resumen ejecutivo de trámites del área
   */
  async getEstadisticasGenerales(userId: string, userRoles: string[]) {
    const idArea = await this.getAreaResponsable(userId, userRoles);

    const where: any = idArea ? { id_area_remitente: idArea } : {};

    const [
      totalEnviados,
      tramitesPendientes,
      tramitesCompletados,
      tramitesAnulados,
      promedioTiempoRespuesta,
      tasaFirmas,
      observacionesPendientes,
    ] = await Promise.all([
      // Total de trámites enviados
      this.prisma.tramite.count({ where }),

      // Trámites pendientes (ENVIADO, ABIERTO, LEIDO)
      this.prisma.tramite.count({
        where: {
          ...where,
          estado: {
            in: [
              ETramitStatus.ENVIADO,
              ETramitStatus.ABIERTO,
              ETramitStatus.LEIDO,
            ],
          },
        },
      }),

      // Trámites completados (FIRMADO, RESPONDIDO)
      this.prisma.tramite.count({
        where: {
          ...where,
          estado: { in: [ETramitStatus.FIRMADO, ETramitStatus.RESPONDIDO] },
        },
      }),

      // Trámites anulados
      this.prisma.tramite.count({
        where: { ...where, estado: ETramitStatus.ANULADO },
      }),

      // Promedio de tiempo de respuesta (fecha_envio -> fecha_leido)
      this.calcularPromedioTiempoRespuesta(where),

      // Tasa de firmas (firmados / requieren firma)
      this.calcularTasaFirmas(where),

      // Observaciones pendientes
      this.prisma.observacion.count({
        where: {
          resuelta: false,
          tramite: idArea ? { id_area_remitente: idArea } : {},
        },
      }),
    ]);

    // Calcular porcentajes
    const porcentajePendientes =
      totalEnviados > 0 ? (tramitesPendientes / totalEnviados) * 100 : 0;

    const porcentajeCompletados =
      totalEnviados > 0 ? (tramitesCompletados / totalEnviados) * 100 : 0;

    return {
      resumen: {
        total_enviados: totalEnviados,
        pendientes: tramitesPendientes,
        completados: tramitesCompletados,
        anulados: tramitesAnulados,
        porcentaje_pendientes: parseFloat(porcentajePendientes.toFixed(2)),
        porcentaje_completados: parseFloat(porcentajeCompletados.toFixed(2)),
      },
      rendimiento: {
        promedio_tiempo_respuesta_horas: promedioTiempoRespuesta,
        tasa_firmas_porcentaje: tasaFirmas,
        observaciones_pendientes: observacionesPendientes,
      },
    };
  }

  /**
   * 2. ESTADÍSTICAS POR PERÍODO
   * Tendencias en el tiempo (últimos 7/30/90/365 días)
   */
  async getEstadisticasPorPeriodo(
    userId: string,
    userRoles: string[],
    periodo: 'semana' | 'mes' | 'trimestre' | 'anio',
  ) {
    const idArea = await this.getAreaResponsable(userId, userRoles);

    const dias: Record<string, number> = {
      semana: 7,
      mes: 30,
      trimestre: 90,
      anio: 365,
    };

    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - dias[periodo]);

    const where: any = {
      fecha_envio: { gte: fechaInicio },
    };

    if (idArea) {
      where.id_area_remitente = idArea;
    }

    // Obtener trámites del período agrupados por fecha
    const tramitesPorDia = await this.prisma.tramite.groupBy({
      by: ['fecha_envio'],
      where,
      _count: true,
      orderBy: { fecha_envio: 'asc' },
    });

    // Agrupar por estado
    const tramitesPorEstado = await this.prisma.tramite.groupBy({
      by: ['estado'],
      where,
      _count: true,
    });

    // Formatear datos para gráficos
    const datosGrafico = this.formatearDatosGrafico(
      tramitesPorDia,
      fechaInicio,
      new Date(),
    );

    const distribucionEstados = tramitesPorEstado.map((item) => ({
      estado: item.estado,
      cantidad: item._count,
    }));

    return {
      periodo,
      fecha_inicio: fechaInicio,
      fecha_fin: new Date(),
      total_tramites: tramitesPorDia.reduce(
        (sum, item) => sum + item._count,
        0,
      ),
      datos_grafico: datosGrafico,
      distribucion_estados: distribucionEstados,
    };
  }

  /**
   * 3. ESTADÍSTICAS POR TRABAJADOR
   * Rendimiento individual de cada trabajador del área
   */
  async getEstadisticasPorTrabajador(userId: string, userRoles: string[]) {
    const idArea = await this.getAreaResponsable(userId, userRoles);

    if (!idArea) {
      return { trabajadores: [] }; // Admin necesita especificar área
    }

    // Obtener trabajadores del área
    const trabajadores = await this.prisma.usuario.findMany({
      where: {
        id_area: idArea,
        activo: true,
        roles: {
          some: {
            rol: { codigo: ERoles.TRAB },
          },
        },
      },
      select: {
        id_usuario: true,
        nombres: true,
        apellidos: true,
        dni: true,
      },
    });

    // Para cada trabajador, calcular estadísticas
    const estadisticasTrabajadores = await Promise.all(
      trabajadores.map(async (trabajador) => {
        const [total, pendientes, completados, promedioDias] =
          await Promise.all([
            this.prisma.tramite.count({
              where: { id_receptor: trabajador.id_usuario },
            }),
            this.prisma.tramite.count({
              where: {
                id_receptor: trabajador.id_usuario,
                estado: {
                  in: [
                    ETramitStatus.ENVIADO,
                    ETramitStatus.ABIERTO,
                    ETramitStatus.LEIDO,
                  ],
                },
              },
            }),
            this.prisma.tramite.count({
              where: {
                id_receptor: trabajador.id_usuario,
                estado: {
                  in: [ETramitStatus.FIRMADO, ETramitStatus.RESPONDIDO],
                },
              },
            }),
            this.calcularPromedioTiempoRespuesta({
              id_receptor: trabajador.id_usuario,
            }),
          ]);

        const porcentajeCompletado =
          total > 0 ? (completados / total) * 100 : 0;

        return {
          id_usuario: trabajador.id_usuario,
          nombre_completo: `${trabajador.nombres} ${trabajador.apellidos}`,
          dni: trabajador.dni,
          total_recibidos: total,
          pendientes,
          completados,
          porcentaje_completado: parseFloat(porcentajeCompletado.toFixed(2)),
          promedio_tiempo_respuesta_horas: promedioDias,
        };
      }),
    );

    // Ordenar por eficiencia (mayor % completado)
    estadisticasTrabajadores.sort(
      (a, b) => b.porcentaje_completado - a.porcentaje_completado,
    );

    return {
      total_trabajadores: trabajadores.length,
      trabajadores: estadisticasTrabajadores,
    };
  }

  /**
   * 4. TIEMPOS DE RESPUESTA
   * Métricas de velocidad de procesamiento
   */
  async getTiemposRespuesta(userId: string, userRoles: string[]) {
    const idArea = await this.getAreaResponsable(userId, userRoles);
    const where: any = idArea ? { id_area_remitente: idArea } : {};

    const tramites = await this.prisma.tramite.findMany({
      where: {
        ...where,
        fecha_leido: { not: null },
      },
      select: {
        fecha_envio: true,
        fecha_abierto: true,
        fecha_leido: true,
        fecha_firmado: true,
      },
    });

    // Calcular tiempos
    const tiempos = {
      envio_apertura: [] as number[],
      apertura_lectura: [] as number[],
      lectura_firma: [] as number[],
      total: [] as number[],
    };

    tramites.forEach((tramite) => {
      const envio = tramite.fecha_envio.getTime();
      const abierto = tramite.fecha_abierto?.getTime();
      const leido = tramite.fecha_leido?.getTime();
      const firmado = tramite.fecha_firmado?.getTime();

      if (abierto) {
        tiempos.envio_apertura.push((abierto - envio) / (1000 * 60 * 60)); // horas
      }

      if (abierto && leido) {
        tiempos.apertura_lectura.push((leido - abierto) / (1000 * 60 * 60));
      }

      if (leido && firmado) {
        tiempos.lectura_firma.push((firmado - leido) / (1000 * 60 * 60));
      }

      if (leido) {
        tiempos.total.push((leido - envio) / (1000 * 60 * 60));
      }
    });

    const calcularEstadisticas = (arr: number[]) => {
      if (arr.length === 0) return { promedio: 0, minimo: 0, maximo: 0 };

      const promedio = arr.reduce((a, b) => a + b, 0) / arr.length;
      const minimo = Math.min(...arr);
      const maximo = Math.max(...arr);

      return {
        promedio: parseFloat(promedio.toFixed(2)),
        minimo: parseFloat(minimo.toFixed(2)),
        maximo: parseFloat(maximo.toFixed(2)),
      };
    };

    return {
      envio_a_apertura: calcularEstadisticas(tiempos.envio_apertura),
      apertura_a_lectura: calcularEstadisticas(tiempos.apertura_lectura),
      lectura_a_firma: calcularEstadisticas(tiempos.lectura_firma),
      tiempo_total: calcularEstadisticas(tiempos.total),
      total_muestras: tramites.length,
    };
  }

  /**
   * 5. TIPOS DE DOCUMENTOS
   * Distribución de tipos de documentos enviados
   */
  async getEstadisticasTiposDocumentos(userId: string, userRoles: string[]) {
    const idArea = await this.getAreaResponsable(userId, userRoles);
    const where: any = idArea ? { id_area_remitente: idArea } : {};

    const tramites = await this.prisma.tramite.findMany({
      where,
      select: {
        documento: {
          select: {
            tipo: {
              select: {
                id_tipo: true,
                codigo: true,
                nombre: true,
                requiere_firma: true,
              },
            },
          },
        },
        estado: true,
      },
    });

    // Agrupar por tipo de documento
    const tiposMap = new Map<
      string,
      {
        nombre: string;
        codigo: string;
        total: number;
        firmados: number;
        pendientes: number;
      }
    >();

    tramites.forEach((tramite) => {
      const tipo = tramite.documento.tipo;
      const key = tipo.id_tipo;

      if (!tiposMap.has(key)) {
        tiposMap.set(key, {
          nombre: tipo.nombre,
          codigo: tipo.codigo,
          total: 0,
          firmados: 0,
          pendientes: 0,
        });
      }

      const stats = tiposMap.get(key)!;
      stats.total++;

      if (tramite.estado === ETramitStatus.FIRMADO) {
        stats.firmados++;
      } else if (
        (
          [
            ETramitStatus.ENVIADO,
            ETramitStatus.ABIERTO,
            ETramitStatus.LEIDO,
          ] as ETramitStatus[]
        ).includes(tramite.estado as ETramitStatus)
      ) {
        stats.pendientes++;
      }
    });

    const distribucion = Array.from(tiposMap.values()).sort(
      (a, b) => b.total - a.total,
    );

    return {
      total_tipos: distribucion.length,
      distribucion,
    };
  }

  /**
   * 6. RANKING DE EFICIENCIA
   * Top trabajadores por velocidad y tasa de completado
   */
  async getRankingEficiencia(userId: string, userRoles: string[]) {
    const estadisticas = await this.getEstadisticasPorTrabajador(
      userId,
      userRoles,
    );

    // Top 5 por porcentaje completado
    const topCompletado = estadisticas.trabajadores.slice(0, 5);

    // Top 5 por velocidad (menor tiempo promedio)
    const topVelocidad = [...estadisticas.trabajadores]
      .sort(
        (a, b) =>
          a.promedio_tiempo_respuesta_horas - b.promedio_tiempo_respuesta_horas,
      )
      .slice(0, 5);

    return {
      top_completado: topCompletado,
      top_velocidad: topVelocidad,
    };
  }

  /**
   * 7. ESTADÍSTICAS DE OBSERVACIONES
   * Análisis de problemas y observaciones
   */
  async getEstadisticasObservaciones(userId: string, userRoles: string[]) {
    const idArea = await this.getAreaResponsable(userId, userRoles);

    const where: any = {
      tramite: idArea ? { id_area_remitente: idArea } : {},
    };

    const [total, pendientes, resueltas, porTipo] = await Promise.all([
      this.prisma.observacion.count({ where }),
      this.prisma.observacion.count({ where: { ...where, resuelta: false } }),
      this.prisma.observacion.count({ where: { ...where, resuelta: true } }),
      this.prisma.observacion.groupBy({
        by: ['tipo'],
        where,
        _count: true,
      }),
    ]);

    const tasaResolucion = total > 0 ? (resueltas / total) * 100 : 0;

    const distribucionTipos = porTipo.map((item) => ({
      tipo: item.tipo,
      cantidad: item._count,
    }));

    return {
      total,
      pendientes,
      resueltas,
      tasa_resolucion: parseFloat(tasaResolucion.toFixed(2)),
      distribucion_por_tipo: distribucionTipos,
    };
  }

  /**
   * 8. ACTIVIDAD RECIENTE
   * Últimos 7 días de actividad
   */
  async getActividadReciente(userId: string, userRoles: string[]) {
    const idArea = await this.getAreaResponsable(userId, userRoles);

    const { inicio: fechaInicio, fin: fechaFin } = this.crearRangoFechas(7);

    const where: any = {
      fecha: {
        gte: fechaInicio,
        lte: fechaFin,
      },
    };

    if (idArea) {
      where.tramite = { id_area_remitente: idArea };
    }

    // Obtener actividades
    const actividades = await this.prisma.historialTramite.findMany({
      where,
      select: {
        id_historial: true,
        accion: true,
        detalle: true,
        estado_nuevo: true,
        fecha: true,
        tramite: {
          select: {
            codigo: true,
            asunto: true,
          },
        },
        usuario: {
          select: {
            nombres: true,
            apellidos: true,
          },
        },
      },
      orderBy: { fecha: 'desc' },
      take: 20,
    });

    const historialesRaw = await this.prisma.historialTramite.findMany({
      where,
      select: {
        fecha: true,
      },
    });

    // Agrupar manualmente con conversión correcta de zona horaria
    const actividadDiariaMap = new Map<string, number>();

    historialesRaw.forEach((historial) => {
      const fechaDia = this.convertirAZonaHorariaPeru(historial.fecha);
      const cantidadActual = actividadDiariaMap.get(fechaDia) || 0;
      actividadDiariaMap.set(fechaDia, cantidadActual + 1);
    });

    const actividadDiaria: Array<{ fecha: string; cantidad: number }> = [];

    for (let i = 6; i >= 0; i--) {
      const fecha = this.obtenerFechaActualPeru();
      fecha.setDate(fecha.getDate() - i);

      const fechaStr = this.convertirAZonaHorariaPeru(fecha);

      actividadDiaria.push({
        fecha: fechaStr,
        cantidad: actividadDiariaMap.get(fechaStr) || 0,
      });
    }

    return {
      ultimas_actividades: actividades.map((a) => ({
        id: a.id_historial,
        accion: a.accion,
        detalle: a.detalle,
        fecha: a.fecha.toISOString(), // Mantener ISO para el frontend
        tramite_codigo: a.tramite.codigo,
        tramite_asunto: a.tramite.asunto,
        usuario: a.usuario
          ? `${a.usuario.nombres} ${a.usuario.apellidos}`
          : 'Sistema',
      })),
      actividad_diaria: actividadDiaria,
    };
  }

  // ==================== HELPERS ====================

  private async calcularPromedioTiempoRespuesta(where: any): Promise<number> {
    const tramites = await this.prisma.tramite.findMany({
      where: {
        ...where,
        fecha_leido: { not: null },
      },
      select: {
        fecha_envio: true,
        fecha_leido: true,
      },
    });

    if (tramites.length === 0) return 0;

    const tiempos = tramites.map((t) => {
      const envio = t.fecha_envio.getTime();
      const leido = t.fecha_leido!.getTime();
      return (leido - envio) / (1000 * 60 * 60); // horas
    });

    const promedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
    return parseFloat(promedio.toFixed(2));
  }

  private async calcularTasaFirmas(where: any): Promise<number> {
    const [requierenFirma, firmados] = await Promise.all([
      this.prisma.tramite.count({
        where: { ...where, requiere_firma: true },
      }),
      this.prisma.tramite.count({
        where: {
          ...where,
          requiere_firma: true,
          estado: ETramitStatus.FIRMADO,
        },
      }),
    ]);

    if (requierenFirma === 0) return 0;

    const tasa = (firmados / requierenFirma) * 100;
    return parseFloat(tasa.toFixed(2));
  }

  private formatearDatosGrafico(
    datos: any[],
    fechaInicio: Date,
    fechaFin: Date,
  ) {
    const resultado: { fecha: string; cantidad: number }[] = [];
    const mapaConteos = new Map<string, number>();

    datos.forEach((item) => {
      const fecha = this.convertirAZonaHorariaPeru(new Date(item.fecha_envio));
      const conteoActual = mapaConteos.get(fecha) || 0;
      mapaConteos.set(fecha, conteoActual + item._count);
    });

    const fechaActual = this.obtenerFechaActualPeru();
    fechaActual.setTime(fechaInicio.getTime());

    const fechaFinAjustada = this.obtenerFechaActualPeru();
    fechaFinAjustada.setTime(fechaFin.getTime());

    while (fechaActual <= fechaFinAjustada) {
      const fechaStr = this.convertirAZonaHorariaPeru(fechaActual);

      resultado.push({
        fecha: fechaStr,
        cantidad: mapaConteos.get(fechaStr) || 0,
      });

      fechaActual.setDate(fechaActual.getDate() + 1);
    }

    return resultado;
  }
}

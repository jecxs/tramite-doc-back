// src/modules/tramite/estadisticas-resp.controller.ts
import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { EstadisticasRespService } from './estadisticas-resp.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ERoles } from 'src/common/enums/ERoles.enum';

@Controller('estadisticas/responsable')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EstadisticasRespController {
  constructor(
    private readonly estadisticasRespService: EstadisticasRespService,
  ) {}

  /**
   * Obtener estadísticas generales del área del responsable
   * GET /api/estadisticas/responsable/general
   * Acceso: RESP, ADMIN
   */
  @Get('general')
  @Roles(ERoles.RESP, ERoles.ADMIN)
  async getEstadisticasGenerales(
    @CurrentUser('id_usuario') userId: string,
    @CurrentUser('roles') userRoles: string[],
  ) {
    return this.estadisticasRespService.getEstadisticasGenerales(
      userId,
      userRoles,
    );
  }

  /**
   * Obtener estadísticas por período de tiempo
   * GET /api/estadisticas/responsable/por-periodo?periodo=mes
   * Acceso: RESP, ADMIN
   */
  @Get('por-periodo')
  @Roles(ERoles.RESP, ERoles.ADMIN)
  async getEstadisticasPorPeriodo(
    @CurrentUser('id_usuario') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Query('periodo') periodo?: 'semana' | 'mes' | 'trimestre' | 'anio',
  ) {
    return this.estadisticasRespService.getEstadisticasPorPeriodo(
      userId,
      userRoles,
      periodo || 'mes',
    );
  }

  /**
   * Obtener estadísticas por trabajador del área
   * GET /api/estadisticas/responsable/por-trabajador
   * Acceso: RESP, ADMIN
   */
  @Get('por-trabajador')
  @Roles(ERoles.RESP, ERoles.ADMIN)
  async getEstadisticasPorTrabajador(
    @CurrentUser('id_usuario') userId: string,
    @CurrentUser('roles') userRoles: string[],
  ) {
    return this.estadisticasRespService.getEstadisticasPorTrabajador(
      userId,
      userRoles,
    );
  }

  /**
   * Obtener estadísticas de tiempos de respuesta
   * GET /api/estadisticas/responsable/tiempos-respuesta
   * Acceso: RESP, ADMIN
   */
  @Get('tiempos-respuesta')
  @Roles(ERoles.RESP, ERoles.ADMIN)
  async getTiemposRespuesta(
    @CurrentUser('id_usuario') userId: string,
    @CurrentUser('roles') userRoles: string[],
  ) {
    return this.estadisticasRespService.getTiemposRespuesta(userId, userRoles);
  }

  /**
   * Obtener estadísticas de tipos de documentos enviados
   * GET /api/estadisticas/responsable/tipos-documentos
   * Acceso: RESP, ADMIN
   */
  @Get('tipos-documentos')
  @Roles(ERoles.RESP, ERoles.ADMIN)
  async getEstadisticasTiposDocumentos(
    @CurrentUser('id_usuario') userId: string,
    @CurrentUser('roles') userRoles: string[],
  ) {
    return this.estadisticasRespService.getEstadisticasTiposDocumentos(
      userId,
      userRoles,
    );
  }

  /**
   * Obtener ranking de trabajadores más eficientes
   * GET /api/estadisticas/responsable/ranking-eficiencia
   * Acceso: RESP, ADMIN
   */
  @Get('ranking-eficiencia')
  @Roles(ERoles.RESP, ERoles.ADMIN)
  async getRankingEficiencia(
    @CurrentUser('id_usuario') userId: string,
    @CurrentUser('roles') userRoles: string[],
  ) {
    return this.estadisticasRespService.getRankingEficiencia(userId, userRoles);
  }

  /**
   * Obtener estadísticas de observaciones
   * GET /api/estadisticas/responsable/observaciones
   * Acceso: RESP, ADMIN
   */
  @Get('observaciones')
  @Roles(ERoles.RESP, ERoles.ADMIN)
  async getEstadisticasObservaciones(
    @CurrentUser('id_usuario') userId: string,
    @CurrentUser('roles') userRoles: string[],
  ) {
    return this.estadisticasRespService.getEstadisticasObservaciones(
      userId,
      userRoles,
    );
  }

  /**
   * Obtener actividad reciente (últimos 7 días)
   * GET /api/estadisticas/responsable/actividad-reciente
   * Acceso: RESP, ADMIN
   */
  @Get('actividad-reciente')
  @Roles(ERoles.RESP, ERoles.ADMIN)
  async getActividadReciente(
    @CurrentUser('id_usuario') userId: string,
    @CurrentUser('roles') userRoles: string[],
  ) {
    return this.estadisticasRespService.getActividadReciente(userId, userRoles);
  }
}

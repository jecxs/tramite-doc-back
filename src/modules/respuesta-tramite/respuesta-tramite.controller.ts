// src/modules/respuesta-tramite/respuesta-tramite.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { RespuestaTramiteService } from './respuesta-tramite.service';
import { CreateRespuestaTramiteDto } from './dto/create-respuesta-tramite.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ERoles } from 'src/common/enums/ERoles.enum';

@Controller('respuesta-tramite')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RespuestaTramiteController {
  constructor(
    private readonly respuestaTramiteService: RespuestaTramiteService,
  ) {}

  /**
   * Crear respuesta de conformidad para un trámite
   * POST /api/respuesta-tramite/:idTramite
   * Acceso: Solo TRAB (receptor del trámite)
   */
  @Post(':idTramite')
  @Roles(ERoles.TRAB)
  async crearRespuesta(
    @Param('idTramite', ParseUUIDPipe) idTramite: string,
    @Body() createRespuestaDto: CreateRespuestaTramiteDto,
    @CurrentUser('id_usuario') userId: string,
    @Req() request: Request,
  ) {
    // Extraer IP del cliente
    const ipAddress =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      request.ip ||
      request.socket.remoteAddress ||
      'IP desconocida';

    // Extraer User-Agent
    const userAgent = request.headers['user-agent'] || 'User-Agent desconocido';

    return this.respuestaTramiteService.crearRespuesta(
      idTramite,
      createRespuestaDto,
      userId,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Obtener respuesta de un trámite
   * GET /api/respuesta-tramite/:idTramite
   * Acceso: ADMIN, RESP (remitente), TRAB (receptor)
   */
  @Get(':idTramite')
  @Roles(ERoles.ADMIN, ERoles.RESP, ERoles.TRAB)
  async obtenerRespuesta(
    @Param('idTramite', ParseUUIDPipe) idTramite: string,
    @CurrentUser('id_usuario') userId: string,
    @CurrentUser('roles') userRoles: string[],
  ) {
    return this.respuestaTramiteService.obtenerRespuesta(
      idTramite,
      userId,
      userRoles,
    );
  }

  /**
   * Obtener estadísticas de respuestas
   * GET /api/respuesta-tramite/estadisticas/general
   * Acceso: Solo ADMIN y RESP
   */
  @Get('estadisticas/general')
  @Roles(ERoles.ADMIN, ERoles.RESP)
  async obtenerEstadisticas(
    @Query('id_remitente') idRemitente?: string,
    @Query('id_area') idArea?: string,
    @Query('fecha_inicio') fechaInicio?: string,
    @Query('fecha_fin') fechaFin?: string,
  ) {
    const filtros: any = {};

    if (idRemitente) filtros.id_remitente = idRemitente;
    if (idArea) filtros.id_area = idArea;
    if (fechaInicio) filtros.fecha_inicio = new Date(fechaInicio);
    if (fechaFin) filtros.fecha_fin = new Date(fechaFin);

    return this.respuestaTramiteService.obtenerEstadisticas(filtros);
  }
}

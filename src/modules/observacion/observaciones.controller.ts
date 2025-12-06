import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ObservacionesService } from './observaciones.service';
import { CreateObservacionDto } from './dto/create-observacion.dto';
import { ResponderObservacionDto } from './dto/responder-observacion.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ERoles } from 'src/common/enums/ERoles.enum';

@Controller('observaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ObservacionesController {
  constructor(private readonly observacionesService: ObservacionesService) {}

  /**
   * Crear una observación en un trámite
   * POST /api/observaciones/tramite/:id
   * Acceso: TRAB (solo el receptor del trámite)
   */
  @Post('tramite/:id')
  @Roles(ERoles.TRAB)
  create(
    @Param('id', ParseUUIDPipe) idTramite: string,
    @Body() createObservacionDto: CreateObservacionDto,
    @CurrentUser('id_usuario') userId: string,
  ) {
    return this.observacionesService.create(
      idTramite,
      createObservacionDto,
      userId,
    );
  }

  /**
   * Listar observaciones de un trámite
   * GET /api/observaciones/tramite/:id
   * Acceso: ADMIN, RESP (remitente), TRAB (receptor)
   */
  @Get('tramite/:id')
  @Roles(ERoles.ADMIN, ERoles.RESP, ERoles.TRAB)
  findByTramite(
    @Param('id', ParseUUIDPipe) idTramite: string,
    @CurrentUser('id_usuario') userId: string,
    @CurrentUser('roles') userRoles: string[],
  ) {
    return this.observacionesService.findByTramite(
      idTramite,
      userId,
      userRoles,
    );
  }

  /**
   * Listar observaciones pendientes (sin resolver)
   * GET /api/observaciones/pendientes
   * Acceso: ADMIN, RESP (sus trámites), TRAB (sus observaciones)
   */
  @Get('pendientes')
  @Roles(ERoles.ADMIN, ERoles.RESP, ERoles.TRAB)
  findPendientes(
    @CurrentUser('id_usuario') userId: string,
    @CurrentUser('roles') userRoles: string[],
  ) {
    return this.observacionesService.findPendientes(userId, userRoles);
  }

  /**
   * Obtener estadísticas de observaciones
   * GET /api/observaciones/statistics
   * Acceso: ADMIN, RESP, TRAB (filtrado según permisos)
   */
  @Get('statistics')
  @Roles(ERoles.ADMIN, ERoles.RESP, ERoles.TRAB)
  getStatistics(
    @CurrentUser('id_usuario') userId: string,
    @CurrentUser('roles') userRoles: string[],
  ) {
    return this.observacionesService.getStatistics(userId, userRoles);
  }

  /**
   * Obtener una observación por ID
   * GET /api/observaciones/:id
   * Acceso: ADMIN, RESP (remitente), TRAB (receptor)
   */
  @Get(':id')
  @Roles(ERoles.ADMIN, ERoles.RESP, ERoles.TRAB)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id_usuario') userId: string,
    @CurrentUser('roles') userRoles: string[],
  ) {
    return this.observacionesService.findOne(id, userId, userRoles);
  }

  /**
   * Responder una observación (marcarla como resuelta)
   * PATCH /api/observaciones/:id/responder
   * Acceso: RESP (solo el remitente del trámite)
   */
  @Patch(':id/responder')
  @Roles(ERoles.RESP, ERoles.ADMIN)
  responder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() responderDto: ResponderObservacionDto,
    @CurrentUser('id_usuario') userId: string,
  ) {
    return this.observacionesService.responder(id, responderDto, userId);
  }
}

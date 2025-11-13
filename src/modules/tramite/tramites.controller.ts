import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TramitesService } from './tramites.service';
import { CreateTramiteDto } from './dto/create-tramite.dto';
import { ReenviarTramiteDto } from './dto/reenviar-tramite.dto';
import { AnularTramiteDto } from './dto/anular-tramite.dto';
import { FilterTramiteDto } from './dto/filter-tramite.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('tramites')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TramitesController {
  constructor(private readonly tramitesService: TramitesService) {}

  /**
   * Crear un nuevo trámite (enviar documento)
   * POST /api/tramites
   * Acceso: ADMIN, RESP
   */
  @Post()
  @Roles('ADMIN', 'RESP')
  create(
    @Body() createTramiteDto: CreateTramiteDto,
    @CurrentUser('id_usuario') userId: string,
  ) {
    return this.tramitesService.create(createTramiteDto, userId);
  }

  /**
   * Obtener todos los trámites con filtros
   * GET /api/tramites
   * Acceso: ADMIN (ve todos), RESP (ve enviados por él), TRAB (ve recibidos)
   */
  @Get()
  @Roles('ADMIN', 'RESP', 'TRAB')
  findAll(
    @Query() filterDto: FilterTramiteDto,
    @CurrentUser('id_usuario') userId: string,
    @CurrentUser('roles') userRoles: string[],
  ) {
    return this.tramitesService.findAll(filterDto, userId, userRoles);
  }

  /**
   * Obtener estadísticas de trámites
   * GET /api/tramites/statistics
   * Acceso: ADMIN, RESP, TRAB (filtrado según permisos)
   */
  @Get('statistics')
  @Roles('ADMIN', 'RESP', 'TRAB')
  getStatistics(
    @CurrentUser('id_usuario') userId: string,
    @CurrentUser('roles') userRoles: string[],
  ) {
    return this.tramitesService.getStatistics(userId, userRoles);
  }

  /**
   * Obtener un trámite por ID
   * GET /api/tramites/:id
   * Acceso: ADMIN, RESP (si es remitente), TRAB (si es receptor)
   */
  @Get(':id')
  @Roles('ADMIN', 'RESP', 'TRAB')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id_usuario') userId: string,
    @CurrentUser('roles') userRoles: string[],
  ) {
    return this.tramitesService.findOne(id, userId, userRoles);
  }

  /**
   * Marcar trámite como abierto
   * PATCH /api/tramites/:id/abrir
   * Acceso: TRAB (solo el receptor)
   */
  @Patch(':id/abrir')
  @Roles('TRAB')
  marcarComoAbierto(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id_usuario') userId: string,
  ) {
    return this.tramitesService.marcarComoAbierto(id, userId);
  }

  /**
   * Marcar trámite como leído
   * PATCH /api/tramites/:id/leer
   * Acceso: TRAB (solo el receptor)
   */
  @Patch(':id/leer')
  @Roles('TRAB')
  marcarComoLeido(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id_usuario') userId: string,
  ) {
    return this.tramitesService.marcarComoLeido(id, userId);
  }

  /**
   * Reenviar trámite con documento corregido
   * POST /api/tramites/:id/reenviar
   * Acceso: ADMIN, RESP (solo el remitente)
   */
  @Post(':id/reenviar')
  @Roles('ADMIN', 'RESP')
  reenviar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() reenviarDto: ReenviarTramiteDto,
    @CurrentUser('id_usuario') userId: string,
  ) {
    return this.tramitesService.reenviar(id, reenviarDto, userId);
  }

  /**
   * Anular un trámite
   * PATCH /api/tramites/:id/anular
   * Acceso: ADMIN, RESP (solo el remitente)
   */
  @Patch(':id/anular')
  @Roles('ADMIN', 'RESP')
  anular(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() anularDto: AnularTramiteDto,
    @CurrentUser('id_usuario') userId: string,
    @CurrentUser('roles') userRoles: string[],
  ) {
    return this.tramitesService.anular(id, anularDto, userId, userRoles);
  }
}

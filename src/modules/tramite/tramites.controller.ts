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
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
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
import { CreateTramiteBulkDto } from './dto/create-tramite-bulk.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CreateTramiteAutoLoteDto } from './dto/create-tramite-auto-lote.dto';
import { ERoles } from 'src/common/enums/ERoles.enum';

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
  @Roles(ERoles.ADMIN, ERoles.RESP)
  create(
    @Body() createTramiteDto: CreateTramiteDto,
    @CurrentUser('id_usuario') userId: string,
  ) {
    return this.tramitesService.create(createTramiteDto, userId);
  }
  /**
   * Crear múltiples trámites (envío masivo)
   * POST /api/tramites/bulk
   * Acceso: ADMIN, RESP
   */
  @Post('bulk')
  @Roles(ERoles.ADMIN, ERoles.RESP)
  createBulk(
    @Body() createBulkDto: CreateTramiteBulkDto,
    @CurrentUser('id_usuario') userId: string,
  ) {
    return this.tramitesService.createBulk(createBulkDto, userId);
  }

  /**
   * Obtener todos los trámites con filtros
   * GET /api/tramites
   * Acceso: ADMIN (ve todos), RESP (ve enviados por él), TRAB (ve recibidos)
   */
  @Get()
  @Roles(ERoles.ADMIN, ERoles.RESP, ERoles.TRAB)
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
  @Roles(ERoles.ADMIN, ERoles.RESP, ERoles.TRAB)
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
  @Roles(ERoles.ADMIN, ERoles.RESP, ERoles.TRAB)
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
  @Roles(ERoles.TRAB)
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
  @Roles(ERoles.TRAB)
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
  @Roles(ERoles.ADMIN, ERoles.RESP)
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
  @Roles(ERoles.ADMIN, ERoles.RESP)
  anular(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() anularDto: AnularTramiteDto,
    @CurrentUser('id_usuario') userId: string,
    @CurrentUser('roles') userRoles: string[],
  ) {
    return this.tramitesService.anular(id, anularDto, userId, userRoles);
  }

  /**
   * PASO 1: Detectar destinatarios automáticamente (PREVIEW)
   * POST /api/tramites/auto-lote/detectar
   * Acceso: ADMIN, RESP
   *
   * Sube múltiples archivos y detecta destinatarios por DNI
   * Sin crear trámites aún, solo para visualizar
   */
  @Post('auto-lote/detectar')
  @Roles(ERoles.ADMIN, ERoles.RESP)
  @UseInterceptors(FilesInterceptor('archivos', 50)) // Max 50 archivos
  async detectarDestinatarios(
    @UploadedFiles() archivos: Express.Multer.File[],
    @Body('id_tipo_documento') idTipoDocumento: string,
    @CurrentUser('id_usuario') userId: string,
  ) {
    if (!archivos || archivos.length === 0) {
      throw new BadRequestException('No se han proporcionado archivos');
    }

    if (!idTipoDocumento) {
      throw new BadRequestException('El tipo de documento es obligatorio');
    }

    return this.tramitesService.detectarDestinatarios(
      archivos,
      idTipoDocumento,
      userId,
    );
  }

  /**
   * PASO 2: Crear trámites automáticos en lote (CONFIRMACIÓN)
   * POST /api/tramites/auto-lote
   * Acceso: ADMIN, RESP
   *
   * Crea los trámites con documentos ya subidos y validados
   */
  @Post('auto-lote')
  @Roles(ERoles.ADMIN, ERoles.RESP)
  async createAutoLote(
    @Body() createAutoLoteDto: CreateTramiteAutoLoteDto,
    @CurrentUser('id_usuario') userId: string,
  ) {
    return this.tramitesService.createAutoLote(createAutoLoteDto, userId);
  }

  /**
   * Generar mensajes predeterminados para preview
   * GET /api/tramites/auto-lote/template/:codigoTipo
   * Acceso: ADMIN, RESP
   */
  @Get('auto-lote/template/:codigoTipo')
  @Roles(ERoles.ADMIN, ERoles.RESP)
  getDefaultTemplate(
    @Param('codigoTipo') codigoTipo: string,
    @Query('nombreTrabajador') nombreTrabajador: string,
  ) {
    return this.tramitesService.generateDefaultMessage(
      codigoTipo,
      nombreTrabajador || 'Trabajador',
    );
  }
}

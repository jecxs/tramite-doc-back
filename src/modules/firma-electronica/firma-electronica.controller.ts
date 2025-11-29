import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { FirmaElectronicaService } from './firma-electronica.service';
import { CreateFirmaElectronicaDto } from './dto/create-firma-electronica.dto';
import { VerificarCodigoDto } from '../verificacion-firma/dto/verificar-codigo.dto';
import { VerificacionFirmaService } from '../verificacion-firma/verificacion-firma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('firma-electronica')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FirmaElectronicaController {
  constructor(
    private readonly firmaElectronicaService: FirmaElectronicaService,
    private readonly verificacionFirmaService: VerificacionFirmaService,
  ) {}

  /**
   * PASO 1: Solicitar código de verificación
   * POST /api/firma-electronica/tramite/:id/solicitar-codigo
   * Acceso: TRAB (solo el receptor del trámite)
   */
  @Post('tramite/:id/solicitar-codigo')
  @Roles('TRAB')
  async solicitarCodigoVerificacion(
    @Param('id', ParseUUIDPipe) idTramite: string,
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

    return this.verificacionFirmaService.generarYEnviarCodigo(
      idTramite,
      userId,
      ipAddress,
      userAgent,
    );
  }

  /**
   * PASO 2: Verificar código y firmar documento
   * POST /api/firma-electronica/tramite/:id/verificar-y-firmar
   * Acceso: TRAB (solo el receptor del trámite)
   */
  @Post('tramite/:id/verificar-y-firmar')
  @Roles('TRAB')
  async verificarYFirmar(
    @Param('id', ParseUUIDPipe) idTramite: string,
    @Body()
    body: {
      codigo: string;
      acepta_terminos: boolean;
    },
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

    // 1. Validar código de verificación
    await this.verificacionFirmaService.validarCodigo(
      idTramite,
      userId,
      body.codigo,
      ipAddress,
    );

    // 2. Si el código es válido, proceder con la firma
    return this.firmaElectronicaService.firmar(
      idTramite,
      { acepta_terminos: body.acepta_terminos },
      userId,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Obtener firma electrónica de un trámite
   * GET /api/firma-electronica/tramite/:id
   * Acceso: ADMIN, RESP (remitente), TRAB (receptor)
   */
  @Get('tramite/:id')
  @Roles('ADMIN', 'RESP', 'TRAB')
  findByTramite(
    @Param('id', ParseUUIDPipe) idTramite: string,
    @CurrentUser('id_usuario') userId: string,
    @CurrentUser('roles') userRoles: string[],
  ) {
    return this.firmaElectronicaService.findByTramite(
      idTramite,
      userId,
      userRoles,
    );
  }

  /**
   * Verificar estado de firma de un trámite
   * GET /api/firma-electronica/tramite/:id/verificar
   * Acceso: Público (cualquier usuario autenticado puede verificar)
   */
  @Get('tramite/:id/verificar')
  @Roles('ADMIN', 'RESP', 'TRAB')
  verificarFirma(@Param('id', ParseUUIDPipe) idTramite: string) {
    return this.firmaElectronicaService.verificarFirma(idTramite);
  }

  /**
   * Obtener estadísticas de firmas electrónicas
   * GET /api/firma-electronica/statistics
   * Acceso: Solo ADMIN
   */
  @Get('statistics')
  @Roles('ADMIN')
  getStatistics() {
    return this.firmaElectronicaService.getStatistics();
  }

  /**
   * Obtener estadísticas de códigos de verificación
   * GET /api/firma-electronica/verificacion/statistics
   * Acceso: Solo ADMIN
   */
  @Get('verificacion/statistics')
  @Roles('ADMIN')
  getVerificacionStatistics() {
    return this.verificacionFirmaService.getEstadisticas();
  }
}

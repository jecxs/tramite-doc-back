import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ReportesRespService, FiltrosReporte } from './reportes-resp.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ERoles } from 'src/common/enums/ERoles.enum';
import { IsOptional, IsString, IsDateString } from 'class-validator';

export class FiltrosReporteDto implements FiltrosReporte {
  @IsOptional()
  @IsDateString()
  fecha_inicio?: string;

  @IsOptional()
  @IsDateString()
  fecha_fin?: string;

  @IsOptional()
  @IsString()
  id_tipo_documento?: string;

  @IsOptional()
  @IsString()
  id_area?: string;
}

@Controller('reportes/responsable')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportesRespController {
  constructor(private readonly reportesService: ReportesRespService) {}

  /**
   * Generar reporte personalizado con filtros
   * GET /api/reportes/responsable/personalizado
   * Acceso: RESP, ADMIN
   */
  @Get('personalizado')
  @Roles(ERoles.RESP, ERoles.ADMIN)
  async generarReportePersonalizado(
    @CurrentUser('id_usuario') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Query() filtros: FiltrosReporteDto,
  ) {
    return this.reportesService.generarReportePersonalizado(
      userId,
      userRoles,
      filtros,
    );
  }
}

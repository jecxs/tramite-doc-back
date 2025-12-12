import { Module } from '@nestjs/common';
import { TramitesService } from './tramites.service';
import { TramitesController } from './tramites.controller';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { EstadisticasRespService } from './estadisticas-resp.service';
import { EstadisticasRespController } from './estadisticas-resp.controller';
import { ReportesRespService } from './reportes-resp.service';
import { ReportesRespController } from './reportes-resp.controller';

@Module({
  imports: [NotificacionesModule],
  controllers: [
    TramitesController,
    EstadisticasRespController,
    ReportesRespController,
  ],
  providers: [TramitesService, EstadisticasRespService, ReportesRespService],
  exports: [TramitesService, EstadisticasRespService, ReportesRespService],
})
export class TramitesModule {}

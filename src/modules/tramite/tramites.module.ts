import { Module } from '@nestjs/common';
import { TramitesService } from './tramites.service';
import { TramitesController } from './tramites.controller';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { EstadisticasRespService } from './estadisticas-resp.service';
import { EstadisticasRespController } from './estadisticas-resp.controller';

@Module({
  imports: [NotificacionesModule],
  controllers: [TramitesController, EstadisticasRespController],
  providers: [TramitesService, EstadisticasRespService],
  exports: [TramitesService, EstadisticasRespService],
})
export class TramitesModule {}

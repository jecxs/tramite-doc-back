import { Module } from '@nestjs/common';
import { ObservacionesService } from './observaciones.service';
import { ObservacionesController } from './observaciones.controller';
import { NotificacionesGateway } from './notificaciones.gateway';

@Module({
  controllers: [ObservacionesController],
  providers: [ObservacionesService, NotificacionesGateway],
  exports: [ObservacionesService, NotificacionesGateway],
})
export class ObservacionesModule {}
import { Module } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { NotificacionesController } from './notificaciones.controller';
import { ObservacionesModule } from '../observacion/observaciones.module';

@Module({
  imports: [ObservacionesModule], // Importar para usar NotificacionesGateway
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}

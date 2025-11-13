import { forwardRef, Module } from '@nestjs/common';
import { ObservacionesService } from './observaciones.service';
import { ObservacionesController } from './observaciones.controller';
import { NotificacionesGateway } from './notificaciones.gateway';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [forwardRef(() => NotificacionesModule)],
  controllers: [ObservacionesController],
  providers: [ObservacionesService, NotificacionesGateway],
  exports: [ObservacionesService, NotificacionesGateway],
})
export class ObservacionesModule {}

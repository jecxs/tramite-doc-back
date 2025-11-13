import { Module } from '@nestjs/common';
import { FirmaElectronicaService } from './firma-electronica.service';
import { FirmaElectronicaController } from './firma-electronica.controller';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [NotificacionesModule],
  controllers: [FirmaElectronicaController],
  providers: [FirmaElectronicaService],
  exports: [FirmaElectronicaService],
})
export class FirmaElectronicaModule {}

import { Module } from '@nestjs/common';
import { FirmaElectronicaService } from './firma-electronica.service';
import { FirmaElectronicaController } from './firma-electronica.controller';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { VerificacionFirmaModule } from '../verificacion-firma/verificacion-firma.module';

@Module({
  imports: [NotificacionesModule, VerificacionFirmaModule],
  controllers: [FirmaElectronicaController],
  providers: [FirmaElectronicaService],
  exports: [FirmaElectronicaService],
})
export class FirmaElectronicaModule {}
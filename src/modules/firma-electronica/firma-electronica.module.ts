import { Module } from '@nestjs/common';
import { FirmaElectronicaService } from './firma-electronica.service';
import { FirmaElectronicaController } from './firma-electronica.controller';

@Module({
  controllers: [FirmaElectronicaController],
  providers: [FirmaElectronicaService],
  exports: [FirmaElectronicaService],
})
export class FirmaElectronicaModule {}
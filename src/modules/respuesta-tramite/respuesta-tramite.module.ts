// src/modules/respuesta-tramite/respuesta-tramite.module.ts
import { Module } from '@nestjs/common';
import { RespuestaTramiteService } from './respuesta-tramite.service';
import { RespuestaTramiteController } from './respuesta-tramite.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [PrismaModule, NotificacionesModule],
  controllers: [RespuestaTramiteController],
  providers: [RespuestaTramiteService],
  exports: [RespuestaTramiteService],
})
export class RespuestaTramiteModule {}

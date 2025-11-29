import { Module } from '@nestjs/common';
import { VerificacionFirmaService } from './verificacion-firma.service';
import { EmailService } from '../../common/services/email.service';

@Module({
  providers: [VerificacionFirmaService, EmailService],
  exports: [VerificacionFirmaService],
})
export class VerificacionFirmaModule {}
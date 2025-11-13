import { Module } from '@nestjs/common';
import { DocumentosService } from './documentos.service';
import { DocumentosController } from './documentos.controller';
import { R2Service } from '../../common/services/r2.service';

@Module({
  controllers: [DocumentosController],
  providers: [DocumentosService, R2Service],
  exports: [DocumentosService],
})
export class DocumentosModule {}

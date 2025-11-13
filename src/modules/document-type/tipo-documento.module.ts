import { Module } from '@nestjs/common';
import { TipoDocumentoService } from './tipo-documento.service';
import { TipoDocumentoController } from './tipo-documento.controller';

@Module({
  controllers: [TipoDocumentoController],
  providers: [TipoDocumentoService],
  exports: [TipoDocumentoService],
})
export class TipoDocumentoModule {}

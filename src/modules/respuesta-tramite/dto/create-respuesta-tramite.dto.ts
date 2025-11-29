// src/modules/respuesta-tramite/dto/create-respuesta-tramite.dto.ts
import {
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';

export class CreateRespuestaTramiteDto {
  @IsBoolean()
  @IsNotEmpty({ message: 'Debe confirmar que ha leído el documento' })
  acepta_conformidad: boolean; // Cambio: simple booleano de aceptación
}
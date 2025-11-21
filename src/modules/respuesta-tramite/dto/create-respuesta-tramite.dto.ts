// src/modules/respuesta-tramite/dto/create-respuesta-tramite.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateRespuestaTramiteDto {
  @IsString()
  @IsNotEmpty({ message: 'El texto de respuesta es obligatorio' })
  @MinLength(10, { message: 'La respuesta debe tener al menos 10 caracteres' })
  @MaxLength(2000, { message: 'La respuesta no puede exceder 2000 caracteres' })
  texto_respuesta: string;

  @IsBoolean()
  @IsOptional()
  esta_conforme?: boolean; // Por defecto será true
}

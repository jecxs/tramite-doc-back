// src/modules/tramite/dto/create-tramite-bulk.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  IsOptional,
  IsArray,
  ArrayMinSize,
  ArrayNotEmpty,
} from 'class-validator';

export class CreateTramiteBulkDto {
  @IsUUID('4', { message: 'El ID del documento debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El documento es obligatorio' })
  id_documento: string;

  @IsArray({ message: 'Los receptores deben ser un array' })
  @ArrayNotEmpty({ message: 'Debe seleccionar al menos un receptor' })
  @ArrayMinSize(1, { message: 'Debe seleccionar al menos un receptor' })
  @IsUUID('4', {
    each: true,
    message: 'Cada receptor debe ser un UUID válido',
  })
  id_receptores: string[];

  @IsString({ message: 'El asunto debe ser un texto' })
  @IsNotEmpty({ message: 'El asunto es obligatorio' })
  @MaxLength(255, { message: 'El asunto no puede tener más de 255 caracteres' })
  asunto: string;

  @IsOptional()
  @IsString({ message: 'El mensaje debe ser un texto' })
  mensaje?: string;
}

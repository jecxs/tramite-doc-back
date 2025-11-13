import {
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class CreateTramiteDto {
  @IsUUID('4', { message: 'El ID del documento debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El documento es obligatorio' })
  id_documento: string;

  @IsUUID('4', { message: 'El ID del receptor debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El receptor es obligatorio' })
  id_receptor: string;

  @IsString({ message: 'El asunto debe ser un texto' })
  @IsNotEmpty({ message: 'El asunto es obligatorio' })
  @MaxLength(255, { message: 'El asunto no puede tener más de 255 caracteres' })
  asunto: string;

  @IsOptional()
  @IsString({ message: 'El mensaje debe ser un texto' })
  mensaje?: string;

  // Los campos requiere_firma y requiere_respuesta se copian automáticamente
  // del tipo de documento, no se envían en el DTO
}

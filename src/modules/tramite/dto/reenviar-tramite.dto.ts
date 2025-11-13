import {
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class ReenviarTramiteDto {
  @IsUUID('4', { message: 'El ID del nuevo documento debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El nuevo documento es obligatorio' })
  id_documento: string; // Documento corregido (nueva versión)

  @IsString({ message: 'El motivo de reenvío debe ser un texto' })
  @IsNotEmpty({ message: 'El motivo de reenvío es obligatorio' })
  motivo_reenvio: string;

  @IsString({ message: 'El asunto debe ser un texto' })
  @IsNotEmpty({ message: 'El asunto es obligatorio' })
  @MaxLength(255, { message: 'El asunto no puede tener más de 255 caracteres' })
  asunto: string;

  @IsOptional()
  @IsString({ message: 'El mensaje debe ser un texto' })
  mensaje?: string;
}
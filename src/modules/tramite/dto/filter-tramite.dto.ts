import { IsOptional, IsString, IsUUID, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class FilterTramiteDto {
  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser un texto' })
  search?: string; // Búsqueda por código, asunto

  @IsOptional()
  @IsUUID('4', { message: 'El ID del remitente debe ser un UUID válido' })
  id_remitente?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del receptor debe ser un UUID válido' })
  id_receptor?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del área debe ser un UUID válido' })
  id_area_remitente?: string;

  @IsOptional()
  @IsIn(['ENVIADO', 'ABIERTO', 'LEIDO', 'FIRMADO', 'ANULADO'], {
    message: 'Estado inválido',
  })
  estado?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  requiere_firma?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  requiere_respuesta?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  es_reenvio?: boolean;
}
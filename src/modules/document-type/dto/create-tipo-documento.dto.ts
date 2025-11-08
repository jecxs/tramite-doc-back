import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsBoolean,
  IsOptional,
  Matches,
} from 'class-validator';

export class CreateTipoDocumentoDto {
  @IsString({ message: 'El código debe ser un texto' })
  @IsNotEmpty({ message: 'El código es obligatorio' })
  @MaxLength(20, { message: 'El código no puede tener más de 20 caracteres' })
  @Matches(/^[A-Z_]+$/, {
    message: 'El código solo debe contener letras mayúsculas y guiones bajos',
  })
  codigo: string;

  @IsString({ message: 'El nombre debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100, { message: 'El nombre no puede tener más de 100 caracteres' })
  nombre: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser un texto' })
  @MaxLength(255, {
    message: 'La descripción no puede tener más de 255 caracteres',
  })
  descripcion?: string;

  @IsOptional()
  @IsBoolean({ message: 'El campo requiere_firma debe ser un booleano' })
  requiere_firma?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'El campo requiere_respuesta debe ser un booleano' })
  requiere_respuesta?: boolean;
}
import {
  IsString,
  MaxLength,
  Matches,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class UpdateRolDto {
  @IsOptional()
  @IsString({ message: 'El código debe ser un texto' })
  @MaxLength(20, { message: 'El código no puede tener más de 20 caracteres' })
  @Matches(/^[A-Z_]+$/, {
    message: 'El código solo debe contener letras mayúsculas y guiones bajos',
  })
  codigo?: string;

  @IsOptional()
  @IsString({ message: 'El nombre debe ser un texto' })
  @MaxLength(50, { message: 'El nombre no puede tener más de 50 caracteres' })
  nombre?: string;

  @IsOptional()
  @IsBoolean({ message: 'El campo activo debe ser un booleano' })
  activo?: boolean;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser un texto' })
  descripcion?: string;
}
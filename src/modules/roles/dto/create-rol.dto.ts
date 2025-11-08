import {
  IsNotEmpty,
  IsString,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';

export class CreateRolDto {
  @IsString({ message: 'El código debe ser un texto' })
  @IsNotEmpty({ message: 'El código es obligatorio' })
  @MaxLength(20, { message: 'El código no puede tener más de 20 caracteres' })
  @Matches(/^[A-Z_]+$/, {
    message: 'El código solo debe contener letras mayúsculas y guiones bajos',
  })
  codigo: string;

  @IsString({ message: 'El nombre debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(50, { message: 'El nombre no puede tener más de 50 caracteres' })
  nombre: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser un texto' })
  descripcion?: string;
}
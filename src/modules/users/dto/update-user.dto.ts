import {
  IsEmail,
  IsString,
  IsUUID,
  IsArray,
  IsBoolean,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString({ message: 'El DNI debe ser un texto' })
  @MinLength(8, { message: 'El DNI debe tener al menos 8 caracteres' })
  @MaxLength(20, { message: 'El DNI no puede tener más de 20 caracteres' })
  @Matches(/^[0-9]+$/, { message: 'El DNI solo debe contener números' })
  dni?: string;

  @IsOptional()
  @IsString({ message: 'Los nombres deben ser un texto' })
  @MaxLength(100, {
    message: 'Los nombres no pueden tener más de 100 caracteres',
  })
  nombres?: string;

  @IsOptional()
  @IsString({ message: 'Los apellidos deben ser un texto' })
  @MaxLength(100, {
    message: 'Los apellidos no pueden tener más de 100 caracteres',
  })
  apellidos?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo debe ser válido' })
  @MaxLength(150, { message: 'El correo no puede tener más de 150 caracteres' })
  correo?: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser un texto' })
  @MaxLength(20, { message: 'El teléfono no puede tener más de 20 caracteres' })
  telefono?: string;

  @IsOptional()
  @IsString({ message: 'La contraseña debe ser un texto' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @MaxLength(255, {
    message: 'La contraseña no puede tener más de 255 caracteres',
  })
  password?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del área debe ser un UUID válido' })
  id_area?: string;

  @IsOptional()
  @IsBoolean({ message: 'El campo activo debe ser un booleano' })
  activo?: boolean;

  @IsOptional()
  @IsArray({ message: 'Los roles deben ser un array' })
  @IsUUID('4', { each: true, message: 'Cada rol debe ser un UUID válido' })
  roles?: string[]; // Array de id_rol
}

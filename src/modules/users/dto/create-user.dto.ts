import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  IsArray,
  ArrayNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';

export class CreateUserDto {
  @IsString({ message: 'El DNI debe ser un texto' })
  @IsNotEmpty({ message: 'El DNI es obligatorio' })
  @MinLength(8, { message: 'El DNI debe tener al menos 8 caracteres' })
  @MaxLength(20, { message: 'El DNI no puede tener más de 20 caracteres' })
  @Matches(/^[0-9]+$/, { message: 'El DNI solo debe contener números' })
  dni: string;

  @IsString({ message: 'Los nombres deben ser un texto' })
  @IsNotEmpty({ message: 'Los nombres son obligatorios' })
  @MaxLength(100, { message: 'Los nombres no pueden tener más de 100 caracteres' })
  nombres: string;

  @IsString({ message: 'Los apellidos deben ser un texto' })
  @IsNotEmpty({ message: 'Los apellidos son obligatorios' })
  @MaxLength(100, { message: 'Los apellidos no pueden tener más de 100 caracteres' })
  apellidos: string;

  @IsEmail({}, { message: 'El correo debe ser válido' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @MaxLength(150, { message: 'El correo no puede tener más de 150 caracteres' })
  correo: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser un texto' })
  @MaxLength(20, { message: 'El teléfono no puede tener más de 20 caracteres' })
  telefono?: string;

  @IsString({ message: 'La contraseña debe ser un texto' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @MaxLength(255, { message: 'La contraseña no puede tener más de 255 caracteres' })
  password: string;

  @IsUUID('4', { message: 'El ID del área debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El área es obligatoria' })
  id_area: string;

  @IsArray({ message: 'Los roles deben ser un array' })
  @ArrayNotEmpty({ message: 'Debe asignar al menos un rol' })
  @IsUUID('4', { each: true, message: 'Cada rol debe ser un UUID válido' })
  roles: string[]; // Array de id_rol
}
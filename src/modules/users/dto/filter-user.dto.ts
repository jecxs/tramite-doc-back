import { IsOptional, IsString, IsBoolean, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class FilterUserDto {
  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser un texto' })
  search?: string; // Búsqueda por nombre, apellido, DNI o correo

  @IsOptional()
  @IsUUID('4', { message: 'El ID del área debe ser un UUID válido' })
  id_area?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del rol debe ser un UUID válido' })
  id_rol?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({ message: 'El campo activo debe ser un booleano' })
  activo?: boolean;
}

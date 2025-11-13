import { IsString, MaxLength, IsBoolean, IsOptional } from 'class-validator';

export class UpdateAreaDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser un texto' })
  @MaxLength(100, { message: 'El nombre no puede tener más de 100 caracteres' })
  nombre?: string;

  @IsOptional()
  @IsBoolean({ message: 'El campo activo debe ser un booleano' })
  activo?: boolean;
}

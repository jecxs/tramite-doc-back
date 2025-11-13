import { IsOptional, IsString, IsUUID } from 'class-validator';

export class FilterDocumentoDto {
  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser un texto' })
  search?: string; // Búsqueda por título o nombre de archivo

  @IsOptional()
  @IsUUID('4', { message: 'El ID del tipo debe ser un UUID válido' })
  id_tipo?: string; // Filtrar por tipo de documento

  @IsOptional()
  @IsUUID('4', { message: 'El ID del creador debe ser un UUID válido' })
  creado_por?: string; // Filtrar por quien subió el documento

  @IsOptional()
  @IsString({ message: 'La extensión debe ser un texto' })
  extension?: string; // Filtrar por extensión (.pdf, .png, etc.)
}

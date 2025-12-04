// src/modules/tramite/dto/filter-tramite.dto.ts
import { IsOptional, IsString, IsUUID, IsIn, IsDateString, IsInt, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class FilterTramiteDto {
  // ============================================
  // FILTROS DE BÚSQUEDA BÁSICA
  // ============================================

  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser un texto' })
  search?: string; // Búsqueda por código, asunto

  // ============================================
  // FILTROS POR USUARIOS Y ÁREAS
  // ============================================

  @IsOptional()
  @IsUUID('4', { message: 'El ID del remitente debe ser un UUID válido' })
  id_remitente?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del receptor debe ser un UUID válido' })
  id_receptor?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del área debe ser un UUID válido' })
  id_area_remitente?: string;

  // ============================================
  // FILTROS POR ESTADO Y TIPO
  // ============================================

  @IsOptional()
  @IsIn(['ENVIADO', 'ABIERTO', 'LEIDO', 'FIRMADO', 'ANULADO', 'RESPONDIDO'], {
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

  // ============================================
  // NUEVO: FILTRO POR TIPO DE DOCUMENTO
  // ============================================

  @IsOptional()
  @IsUUID('4', { message: 'El ID del tipo de documento debe ser un UUID válido' })
  id_tipo_documento?: string;

  // ============================================
  // NUEVO: FILTROS POR RANGO DE FECHAS
  // ============================================

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de inicio debe ser una fecha válida (YYYY-MM-DD)' })
  fecha_envio_desde?: string; // Formato: YYYY-MM-DD

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de fin debe ser una fecha válida (YYYY-MM-DD)' })
  fecha_envio_hasta?: string; // Formato: YYYY-MM-DD

  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe ser una fecha válida (YYYY-MM-DD)' })
  fecha_leido_desde?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe ser una fecha válida (YYYY-MM-DD)' })
  fecha_leido_hasta?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe ser una fecha válida (YYYY-MM-DD)' })
  fecha_firmado_desde?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe ser una fecha válida (YYYY-MM-DD)' })
  fecha_firmado_hasta?: string;

  // ============================================
  // NUEVO: FILTROS ADICIONALES
  // ============================================

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  tiene_observaciones?: boolean; // Filtrar trámites con/sin observaciones

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  observaciones_pendientes?: boolean; // Solo observaciones sin resolver

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  con_respuesta?: boolean; // Filtrar trámites con respuesta de conformidad

  // ============================================
  // NUEVO: ORDENAMIENTO
  // ============================================

  @IsOptional()
  @IsIn(['fecha_envio', 'fecha_leido', 'fecha_firmado', 'asunto', 'codigo', 'estado'], {
    message: 'Campo de ordenamiento inválido',
  })
  ordenar_por?: string; // Campo por el cual ordenar

  @IsOptional()
  @IsIn(['asc', 'desc'], {
    message: 'Orden inválido (debe ser asc o desc)',
  })
  orden?: 'asc' | 'desc'; // Dirección del ordenamiento

  // ============================================
  // NUEVO: PAGINACIÓN
  // ============================================

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página debe ser mayor o igual a 1' })
  pagina?: number; // Número de página (default: 1)

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite debe ser mayor o igual a 1' })
  limite?: number; // Elementos por página (default: 20, max: 100)
}
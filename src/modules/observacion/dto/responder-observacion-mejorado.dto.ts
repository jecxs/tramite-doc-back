// src/modules/observacion/dto/responder-observacion-mejorado.dto.ts
import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

/**
 * DTO mejorado para responder observaciones
 * Permite responder solo con texto O responder + reenviar documento corregido
 */
export class ResponderObservacionMejoradoDto {
  @IsString({ message: 'La respuesta debe ser un texto' })
  @IsNotEmpty({ message: 'La respuesta es obligatoria' })
  respuesta: string;

  /**
   * Si es true, indica que se está adjuntando un documento corregido
   * Esto creará automáticamente un reenvío del trámite
   */
  @IsBoolean({ message: 'incluye_reenvio debe ser un booleano' })
  @IsOptional()
  incluye_reenvio?: boolean = false;

  /**
   * ID del nuevo documento corregido (requerido si incluye_reenvio = true)
   */
  @IsString({ message: 'El ID del documento debe ser un texto' })
  @IsOptional()
  id_documento_corregido?: string;

  /**
   * Título/asunto del documento corregido (opcional)
   * Si no se proporciona, se usa el mismo asunto del trámite original
   */
  @IsString({ message: 'El asunto debe ser un texto' })
  @IsOptional()
  asunto_reenvio?: string;
}

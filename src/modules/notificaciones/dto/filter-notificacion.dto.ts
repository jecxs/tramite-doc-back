import { IsOptional, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class FilterNotificacionDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  visto?: boolean; // Filtrar por visto/no visto

  @IsOptional()
  @IsIn([
    'TRAMITE_RECIBIDO',
    'TRAMITE_FIRMADO',
    'TRAMITE_ANULADO',
    'OBSERVACION_CREADA',
    'OBSERVACION_RESUELTA',
    'DOCUMENTO_REQUIERE_FIRMA',
    'TRAMITE_REENVIADO',
  ], {
    message: 'Tipo de notificación inválido',
  })
  tipo?: string; // Filtrar por tipo
}
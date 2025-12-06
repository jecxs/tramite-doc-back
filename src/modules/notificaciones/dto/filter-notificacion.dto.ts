import { IsOptional, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { ETypeDocument } from 'src/common/enums/ETypeDocument.enum';

export class FilterNotificacionDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  visto?: boolean; // Filtrar por visto/no visto

  @IsOptional()
  @IsIn(
    [
      ETypeDocument.TRAMITE_RECIBIDO,
      ETypeDocument.TRAMITE_FIRMADO,
      ETypeDocument.TRAMITE_ANULADO,
      ETypeDocument.OBSERVACION_CREADA,
      ETypeDocument.OBSERVACION_RESUELTA,
      ETypeDocument.DOCUMENTO_REQUIERE_FIRMA,
      ETypeDocument.TRAMITE_REENVIADO,
    ],
    {
      message: 'Tipo de notificación inválido',
    },
  )
  tipo?: ETypeDocument; // Filtrar por tipo
}

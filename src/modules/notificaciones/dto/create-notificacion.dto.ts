import {
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  IsOptional,
  IsIn,
} from 'class-validator';
import { ETypeDocument } from 'src/common/enums/ETypeDocument.enum';

export class CreateNotificacionDto {
  @IsUUID('4', { message: 'El ID del usuario debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El usuario es obligatorio' })
  id_usuario: string;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del trámite debe ser un UUID válido' })
  id_tramite?: string;

  @IsString({ message: 'El tipo debe ser un texto' })
  @IsNotEmpty({ message: 'El tipo es obligatorio' })
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
  tipo: ETypeDocument;

  @IsString({ message: 'El título debe ser un texto' })
  @IsNotEmpty({ message: 'El título es obligatorio' })
  @MaxLength(255, {
    message: 'El título no puede tener más de 255 caracteres',
  })
  titulo: string;

  @IsString({ message: 'El mensaje debe ser un texto' })
  @IsNotEmpty({ message: 'El mensaje es obligatorio' })
  mensaje: string;
}

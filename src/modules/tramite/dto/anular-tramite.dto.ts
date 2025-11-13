import { IsNotEmpty, IsString } from 'class-validator';

export class AnularTramiteDto {
  @IsString({ message: 'El motivo de anulación debe ser un texto' })
  @IsNotEmpty({ message: 'El motivo de anulación es obligatorio' })
  motivo_anulacion: string;
}
import { IsNotEmpty, IsString, IsIn } from 'class-validator';

export class CreateObservacionDto {
  @IsString({ message: 'El tipo debe ser un texto' })
  @IsNotEmpty({ message: 'El tipo es obligatorio' })
  @IsIn(['CONSULTA', 'CORRECCION_REQUERIDA', 'INFORMACION_ADICIONAL'], {
    message:
      'El tipo debe ser CONSULTA, CORRECCION_REQUERIDA o INFORMACION_ADICIONAL',
  })
  tipo: string;

  @IsString({ message: 'La descripción debe ser un texto' })
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  descripcion: string;
}
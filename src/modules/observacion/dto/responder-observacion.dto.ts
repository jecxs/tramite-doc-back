import { IsNotEmpty, IsString } from 'class-validator';

export class ResponderObservacionDto {
  @IsString({ message: 'La respuesta debe ser un texto' })
  @IsNotEmpty({ message: 'La respuesta es obligatoria' })
  respuesta: string;
}
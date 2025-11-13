import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class UploadDocumentoDto {
  @IsString({ message: 'El título debe ser un texto' })
  @IsNotEmpty({ message: 'El título es obligatorio' })
  @MaxLength(255, {
    message: 'El título no puede tener más de 255 caracteres',
  })
  titulo: string;

  @IsUUID('4', {
    message: 'El ID del tipo de documento debe ser un UUID válido',
  })
  @IsNotEmpty({ message: 'El tipo de documento es obligatorio' })
  id_tipo: string;

  // El archivo viene en el campo 'file' del multipart/form-data
  // No necesita validación de class-validator aquí
}

import { IsBoolean, IsNotEmpty } from 'class-validator';

export class CreateFirmaElectronicaDto {
  @IsBoolean({ message: 'La aceptación de términos debe ser un booleano' })
  @IsNotEmpty({ message: 'Debe aceptar los términos y condiciones' })
  acepta_terminos: boolean;

  // Los siguientes campos se capturan automáticamente del request:
  // - ip_address: IP del cliente
  // - navegador: User-Agent del navegador
  // - dispositivo: Información del dispositivo
  // No se envían en el DTO, se extraen del request
}
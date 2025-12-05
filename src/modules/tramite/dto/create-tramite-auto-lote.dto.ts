// src/modules/tramite/dto/create-tramite-auto-lote.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para representar cada documento individual con su destinatario detectado
 */
export class DocumentoConDestinatarioDto {
  @IsString({ message: 'El DNI debe ser un texto' })
  @IsNotEmpty({ message: 'El DNI es obligatorio' })
  dni: string; // DNI detectado del nombre del archivo

  @IsUUID('4', { message: 'El ID del usuario debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El ID del usuario es obligatorio' })
  id_usuario: string; // ID del trabajador encontrado

  @IsString({ message: 'El ID del documento debe ser un texto' })
  @IsNotEmpty({ message: 'El ID del documento es obligatorio' })
  id_documento: string; // ID del documento subido

  @IsString({ message: 'El asunto debe ser un texto' })
  @IsNotEmpty({ message: 'El asunto es obligatorio' })
  @MaxLength(255, { message: 'El asunto no puede tener más de 255 caracteres' })
  asunto: string; // Asunto personalizado o generado

  @IsOptional()
  @IsString({ message: 'El mensaje debe ser un texto' })
  mensaje?: string; // Mensaje personalizado o generado

  @IsString({ message: 'El nombre del trabajador debe ser un texto' })
  @IsNotEmpty()
  nombre_trabajador: string; // Para mostrar en el frontend

  @IsString({ message: 'El nombre del archivo debe ser un texto' })
  @IsNotEmpty()
  nombre_archivo: string; // Nombre original del archivo
}

/**
 * DTO principal para crear trámites automáticos en lote
 */
export class CreateTramiteAutoLoteDto {
  @IsUUID('4', { message: 'El ID del tipo debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El tipo de documento es obligatorio' })
  id_tipo_documento: string; // Tipo de documento seleccionado

  @IsArray({ message: 'Los documentos deben ser un array' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos un documento' })
  @ValidateNested({ each: true })
  @Type(() => DocumentoConDestinatarioDto)
  documentos: DocumentoConDestinatarioDto[]; // Lista de documentos con destinatarios
}

/**
 * DTO para la respuesta de detección de destinatarios
 * (usado en el endpoint de preview antes de enviar)
 */
export class DeteccionDestinatarioDto {
  @IsString()
  dni: string; // DNI detectado

  @IsString()
  nombre_archivo: string; // Nombre del archivo original

  encontrado: boolean; // Si se encontró el usuario

  id_usuario?: string; // ID del usuario (si se encontró)
  nombre_completo?: string; // Nombre completo del trabajador
  area?: string; // Área del trabajador

  error?: string; // Mensaje de error si no se encontró
}
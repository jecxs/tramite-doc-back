import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { config } from 'src/config';

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private readonly r2Client: S3Client;
  private readonly bucketName: string;

  constructor() {
    if (
      !config.R2_ACCOUNT_ID ||
      !config.R2_ACCESS_KEY_ID ||
      !config.R2_SECRET_ACCESS_KEY ||
      !config.R2_BUCKET_NAME
    ) {
      throw new Error(
        'Las variables de entorno de R2 no están configuradas correctamente',
      );
    }

    this.bucketName = config.R2_BUCKET_NAME;

    // Configurar cliente de R2 (compatible con S3)
    this.r2Client = new S3Client({
      region: 'auto',
      endpoint: config.R2_ENDPOINT,
      credentials: {
        accessKeyId: config.R2_ACCESS_KEY_ID,
        secretAccessKey: config.R2_SECRET_ACCESS_KEY,
      },
    });

    this.logger.log('Servicio de R2 inicializado correctamente');
  }

  /**
   * Subir un archivo a R2
   * @param file Buffer del archivo
   * @param key Ruta/nombre del archivo en R2
   * @param contentType Tipo MIME del archivo
   * @param metadata Metadata adicional
   */
  async uploadFile(
    file: Buffer,
    key: string,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<{ key: string; size: number }> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file,
        ContentType: contentType,
        Metadata: metadata,
      });

      await this.r2Client.send(command);

      this.logger.log(`Archivo subido exitosamente: ${key}`);

      return {
        key,
        size: file.length,
      };
    } catch (error) {
      this.logger.error(`Error al subir archivo a R2: ${error.message}`);
      throw new Error(`Error al subir archivo: ${error.message}`);
    }
  }

  /**
   * Descargar un archivo de R2
   * @param key Ruta/nombre del archivo en R2
   * @returns Buffer del archivo
   */
  async downloadFile(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.r2Client.send(command);

      // Convertir el stream a buffer
      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    } catch (error) {
      this.logger.error(`Error al descargar archivo de R2: ${error.message}`);
      throw new Error(`Error al descargar archivo: ${error.message}`);
    }
  }

  /**
   * Generar URL firmada temporal para descargar un archivo
   * @param key Ruta/nombre del archivo en R2
   * @param expiresIn Tiempo de expiración en segundos (default: 1 hora)
   * @returns URL firmada
   */
  async getSignedDownloadUrl(
    key: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ResponseContentDisposition: 'inline', // Agregar esta línea
        ResponseCacheControl: 'no-cache', // Agregar esta línea
      });

      const url = await getSignedUrl(this.r2Client, command, { expiresIn });
      return url;
    } catch (error) {
      this.logger.error(`Error al generar URL firmada: ${error.message}`);
      throw new Error(`Error al generar URL de descarga: ${error.message}`);
    }
  }

  /**
   * Eliminar un archivo de R2
   * @param key Ruta/nombre del archivo en R2
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.r2Client.send(command);

      this.logger.log(`Archivo eliminado exitosamente: ${key}`);
    } catch (error) {
      this.logger.error(`Error al eliminar archivo de R2: ${error.message}`);
      throw new Error(`Error al eliminar archivo: ${error.message}`);
    }
  }

  /**
   * Verificar si un archivo existe en R2
   * @param key Ruta/nombre del archivo en R2
   * @returns true si existe, false si no
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.r2Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      this.logger.error(
        `Error al verificar existencia de archivo: ${error.message}`,
      );
      throw new Error(`Error al verificar archivo: ${error.message}`);
    }
  }

  /**
   * Obtener metadata de un archivo
   * @param key Ruta/nombre del archivo en R2
   */
  async getFileMetadata(key: string): Promise<{
    size: number;
    contentType: string;
    lastModified: Date;
    metadata?: Record<string, string>;
  }> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.r2Client.send(command);

      return {
        size: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
        lastModified: response.LastModified || new Date(),
        metadata: response.Metadata,
      };
    } catch (error) {
      this.logger.error(
        `Error al obtener metadata del archivo: ${error.message}`,
      );
      throw new Error(`Error al obtener metadata: ${error.message}`);
    }
  }

  /**
   * Generar una ruta única para un archivo
   * @param originalFilename Nombre original del archivo
   * @param userId ID del usuario que sube el archivo
   * @returns Ruta única en formato: documentos/YYYY/MM/uuid-filename.ext
   */
  generateFilePath(originalFilename: string, userId: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Generar UUID simple
    const uuid = crypto.randomUUID();

    // Sanitizar nombre del archivo (remover caracteres especiales)
    const sanitizedFilename = originalFilename
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '-');

    // Construir ruta: documentos/2025/01/uuid-filename.pdf
    return `documentos/${year}/${month}/${uuid}-${sanitizedFilename}`;
  }

  /**
   * Generar ruta para versión de documento
   * @param originalPath Ruta del documento original
   * @param version Número de versión
   */
  generateVersionPath(originalPath: string, version: number): string {
    const parts = originalPath.split('/');
    const filename = parts.pop();

    return `versiones/${parts.join('/')}/v${version}-${filename}`;
  }
}

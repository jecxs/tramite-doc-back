import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  StreamableFile,
  Header,
  Res,
  UploadedFiles,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { DocumentosService } from './documentos.service';
import { UploadDocumentoDto } from './dto/upload-documento.dto';
import { FilterDocumentoDto } from './dto/filter-documento.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { R2Service } from '../../common/services/r2.service';
import { ERoles } from 'src/common/enums/ERoles.enum';

@Controller('documentos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentosController {
  constructor(
    private readonly documentosService: DocumentosService,
    private readonly r2Service: R2Service,
  ) {}

  /**
   * Subir un nuevo documento
   * POST /api/documentos/upload
   * Acceso: ADMIN, RESP (quienes envían documentos)
   */
  @Post('upload')
  @Roles(ERoles.ADMIN, ERoles.RESP)
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Body() uploadDocumentoDto: UploadDocumentoDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id_usuario') userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('No se ha proporcionado ningún archivo');
    }

    return this.documentosService.upload(uploadDocumentoDto, file, userId);
  }

  /**
   * Obtener todos los documentos con filtros opcionales
   * GET /api/documentos?search=contrato&id_tipo=xxx
   * Acceso: ADMIN, RESP
   */
  @Get()
  @Roles(ERoles.ADMIN, ERoles.RESP)
  findAll(@Query() filterDto: FilterDocumentoDto) {
    return this.documentosService.findAll(filterDto);
  }

  /**
   * Obtener estadísticas de documentos
   * GET /api/documentos/statistics
   * Acceso: Solo ADMIN
   */
  @Get('statistics')
  @Roles(ERoles.ADMIN)
  getStatistics() {
    return this.documentosService.getStatistics();
  }

  /**
   * Obtener URL de descarga de un documento
   * GET /api/documentos/:id/download
   * Acceso: ADMIN, RESP, TRAB (según permisos del documento/trámite)
   */
  @Get(':id/download')
  @Roles(ERoles.ADMIN, ERoles.RESP, ERoles.TRAB)
  getDownloadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id_usuario') userId: string,
  ) {
    return this.documentosService.getDownloadUrl(id, userId);
  }

  /**
   * Obtener un documento por ID
   * GET /api/documentos/:id
   * Acceso: ADMIN, RESP
   */
  @Get(':id')
  @Roles(ERoles.ADMIN, ERoles.RESP)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentosService.findOne(id);
  }

  /**
   * Crear nueva versión de un documento (para reenvíos con correcciones)
   * POST /api/documentos/:id/version
   * Acceso: ADMIN, RESP
   */
  @Post(':id/version')
  @Roles(ERoles.ADMIN, ERoles.RESP)
  @UseInterceptors(FileInterceptor('file'))
  async createVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() uploadDocumentoDto: UploadDocumentoDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id_usuario') userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('No se ha proporcionado ningún archivo');
    }

    return this.documentosService.createVersion(
      id,
      uploadDocumentoDto,
      file,
      userId,
    );
  }

  /**
   * Eliminar un documento (solo desarrollo)
   * DELETE /api/documentos/:id
   * Acceso: ADMIN, RESP (solo el creador)
   */
  @Delete(':id')
  @Roles(ERoles.ADMIN, ERoles.RESP)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id_usuario') userId: string,
  ) {
    return this.documentosService.remove(id, userId);
  }
  /**
   * Servir contenido del documento directamente (proxy)
   * GET /api/documentos/:id/content
   * Acceso: ADMIN, RESP, TRAB (según permisos del documento/trámite)
   */
  @Get(':id/content')
  @Roles(ERoles.ADMIN, ERoles.RESP, ERoles.TRAB)
  async getDocumentContent(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id_usuario') userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    // Verificar permisos del documento
    const documento = await this.documentosService.findOne(id);

    // Verificar que el usuario tenga permisos (igual que en getDownloadUrl)
    const tramites = await this.documentosService.getTramitesByDocumento(id);

    const tienePermiso =
      documento.creado_por === userId ||
      tramites.some(
        (t) => t.id_remitente === userId || t.id_receptor === userId,
      );

    if (!tienePermiso) {
      throw new BadRequestException(
        'No tiene permisos para acceder a este documento',
      );
    }

    // Descargar archivo de R2
    const fileBuffer = await this.r2Service.downloadFile(
      documento.ruta_archivo,
    );

    // Configurar headers apropiados
    res.set({
      'Content-Type': this.getContentType(documento.extension),
      'Content-Disposition': `inline; filename="${encodeURIComponent(documento.nombre_archivo)}"`,
      'Cache-Control': 'private, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
    });

    return new StreamableFile(fileBuffer);
  }

  /**
   * Helper para obtener Content-Type según extensión
   */
  private getContentType(extension: string): string {
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.xlsx':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.doc': 'application/msword',
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.csv': 'text/csv',
      '.zip': 'application/zip',
    };

    return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
  }
  /**
   * Subir múltiples documentos en lote
   * POST /api/documentos/upload-batch
   * Acceso: ADMIN, RESP
   */
  @Post('upload-batch')
  @Roles(ERoles.ADMIN, ERoles.RESP)
  @UseInterceptors(FilesInterceptor('archivos', 50)) // Max 50 archivos
  async uploadBatch(
    @UploadedFiles() archivos: Express.Multer.File[],
    @Body('id_tipo_documento') idTipoDocumento: string,
    @CurrentUser('id_usuario') userId: string,
  ) {
    if (!archivos || archivos.length === 0) {
      throw new BadRequestException('No se han proporcionado archivos');
    }

    if (!idTipoDocumento) {
      throw new BadRequestException('El tipo de documento es obligatorio');
    }

    return this.documentosService.uploadBatch(
      archivos,
      idTipoDocumento,
      userId,
    );
  }
}

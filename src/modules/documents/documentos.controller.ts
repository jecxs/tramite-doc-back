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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentosService } from './documentos.service';
import { UploadDocumentoDto } from './dto/upload-documento.dto';
import { FilterDocumentoDto } from './dto/filter-documento.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('documentos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  /**
   * Subir un nuevo documento
   * POST /api/documentos/upload
   * Acceso: ADMIN, RESP (quienes envían documentos)
   */
  @Post('upload')
  @Roles('ADMIN', 'RESP')
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
  @Roles('ADMIN', 'RESP')
  findAll(@Query() filterDto: FilterDocumentoDto) {
    return this.documentosService.findAll(filterDto);
  }

  /**
   * Obtener estadísticas de documentos
   * GET /api/documentos/statistics
   * Acceso: Solo ADMIN
   */
  @Get('statistics')
  @Roles('ADMIN')
  getStatistics() {
    return this.documentosService.getStatistics();
  }

  /**
   * Obtener URL de descarga de un documento
   * GET /api/documentos/:id/download
   * Acceso: ADMIN, RESP, TRAB (según permisos del documento/trámite)
   */
  @Get(':id/download')
  @Roles('ADMIN', 'RESP', 'TRAB')
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
  @Roles('ADMIN', 'RESP')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentosService.findOne(id);
  }

  /**
   * Crear nueva versión de un documento (para reenvíos con correcciones)
   * POST /api/documentos/:id/version
   * Acceso: ADMIN, RESP
   */
  @Post(':id/version')
  @Roles('ADMIN', 'RESP')
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
  @Roles('ADMIN', 'RESP')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id_usuario') userId: string,
  ) {
    return this.documentosService.remove(id, userId);
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TipoDocumentoService } from './tipo-documento.service';
import { CreateTipoDocumentoDto } from './dto/create-tipo-documento.dto';
import { UpdateTipoDocumentoDto } from './dto/update-tipo-documento.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('tipo-documento')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TipoDocumentoController {
  constructor(private readonly tipoDocumentoService: TipoDocumentoService) {}

  /**
   * Crear un nuevo tipo de documento
   * POST /api/tipo-documento
   * Acceso: Solo ADMIN
   */
  @Post()
  @Roles('ADMIN')
  create(@Body() createTipoDocumentoDto: CreateTipoDocumentoDto) {
    return this.tipoDocumentoService.create(createTipoDocumentoDto);
  }

  /**
   * Obtener todos los tipos de documento
   * GET /api/tipo-documento
   * Acceso: ADMIN, RESP (necesitan ver tipos para clasificar documentos al enviar)
   */
  @Get()
  @Roles('ADMIN', 'RESP')
  findAll() {
    return this.tipoDocumentoService.findAll();
  }

  /**
   * Obtener estadísticas de tipos de documento
   * GET /api/tipo-documento/statistics
   * Acceso: Solo ADMIN
   */
  @Get('statistics')
  @Roles('ADMIN')
  getStatistics() {
    return this.tipoDocumentoService.getStatistics();
  }

  /**
   * Obtener tipos de documento que requieren firma
   * GET /api/tipo-documento/requiere-firma
   * Acceso: ADMIN, RESP (útil al enviar documentos)
   */
  @Get('requiere-firma')
  @Roles('ADMIN', 'RESP')
  findRequiereFirma() {
    return this.tipoDocumentoService.findRequiereFirma();
  }

  /**
   * Obtener tipos de documento que requieren respuesta
   * GET /api/tipo-documento/requiere-respuesta
   * Acceso: ADMIN, RESP (útil al enviar documentos)
   */
  @Get('requiere-respuesta')
  @Roles('ADMIN', 'RESP')
  findRequiereRespuesta() {
    return this.tipoDocumentoService.findRequiereRespuesta();
  }

  /**
   * Obtener un tipo de documento por código
   * GET /api/tipo-documento/codigo/:codigo
   * Acceso: ADMIN, RESP
   */
  @Get('codigo/:codigo')
  @Roles('ADMIN', 'RESP')
  findByCodigo(@Param('codigo') codigo: string) {
    return this.tipoDocumentoService.findByCodigo(codigo);
  }

  /**
   * Obtener un tipo de documento por ID
   * GET /api/tipo-documento/:id
   * Acceso: ADMIN, RESP
   */
  @Get(':id')
  @Roles('ADMIN', 'RESP')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tipoDocumentoService.findOne(id);
  }

  /**
   * Actualizar un tipo de documento
   * PATCH /api/tipo-documento/:id
   * Acceso: Solo ADMIN
   */
  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTipoDocumentoDto: UpdateTipoDocumentoDto,
  ) {
    return this.tipoDocumentoService.update(id, updateTipoDocumentoDto);
  }

  /**
   * Eliminar un tipo de documento (solo desarrollo)
   * DELETE /api/tipo-documento/:id
   * Acceso: Solo ADMIN
   */
  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tipoDocumentoService.remove(id);
  }
}

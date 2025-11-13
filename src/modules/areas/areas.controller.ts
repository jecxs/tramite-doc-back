import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseUUIDPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { AreasService } from './areas.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('areas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  /**
   * Crear una nueva área
   * POST /api/areas
   * Acceso: Solo ADMIN
   */
  @Post()
  @Roles('ADMIN')
  create(@Body() createAreaDto: CreateAreaDto) {
    return this.areasService.create(createAreaDto);
  }

  /**
   * Obtener todas las áreas
   * GET /api/areas?includeInactive=false
   * Acceso: ADMIN, RESP (todos pueden ver las áreas)
   */
  @Get()
  @Roles('ADMIN', 'RESP')
  findAll(@Query('includeInactive', ParseBoolPipe) includeInactive?: boolean) {
    return this.areasService.findAll(includeInactive);
  }

  /**
   * Obtener estadísticas de áreas
   * GET /api/areas/statistics
   * Acceso: Solo ADMIN
   */
  @Get('statistics')
  @Roles('ADMIN')
  getStatistics() {
    return this.areasService.getStatistics();
  }

  /**
   * Obtener un área por ID
   * GET /api/areas/:id
   * Acceso: ADMIN, RESP
   */
  @Get(':id')
  @Roles('ADMIN', 'RESP')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.areasService.findOne(id);
  }

  /**
   * Obtener todos los usuarios de un área
   * GET /api/areas/:id/users
   * Acceso: ADMIN puede ver cualquier área, RESP solo su propia área
   */
  @Get(':id/users')
  @Roles('ADMIN', 'RESP')
  async getUsersByArea(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: any,
  ) {
    // Si es RESP y no es ADMIN, solo puede ver usuarios de su propia área
    if (
      currentUser.roles.includes('RESP') &&
      !currentUser.roles.includes('ADMIN')
    ) {
      if (currentUser.id_area !== id) {
        throw new Error('No tiene permisos para ver usuarios de otras áreas');
      }
    }

    return this.areasService.getUsersByArea(id);
  }

  /**
   * Obtener responsables de un área (usuarios con rol RESP)
   * GET /api/areas/:id/responsables
   * Acceso: ADMIN, RESP
   */
  @Get(':id/responsables')
  @Roles('ADMIN', 'RESP')
  async getResponsablesByArea(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: any,
  ) {
    // Si es RESP y no es ADMIN, solo puede ver responsables de su propia área
    if (
      currentUser.roles.includes('RESP') &&
      !currentUser.roles.includes('ADMIN')
    ) {
      if (currentUser.id_area !== id) {
        throw new Error(
          'No tiene permisos para ver responsables de otras áreas',
        );
      }
    }

    return this.areasService.getResponsablesByArea(id);
  }

  /**
   * Obtener trabajadores de un área (usuarios con rol TRAB)
   * GET /api/areas/:id/trabajadores
   * Acceso: ADMIN, RESP (RESP solo puede ver trabajadores de su área)
   */
  @Get(':id/trabajadores')
  @Roles('ADMIN', 'RESP')
  async getTrabajadoresByArea(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: any,
  ) {
    // Si es RESP y no es ADMIN, solo puede ver trabajadores de su propia área
    if (
      currentUser.roles.includes('RESP') &&
      !currentUser.roles.includes('ADMIN')
    ) {
      if (currentUser.id_area !== id) {
        throw new Error(
          'No tiene permisos para ver trabajadores de otras áreas',
        );
      }
    }

    return this.areasService.getTrabajadoresByArea(id);
  }

  /**
   * Actualizar un área
   * PATCH /api/areas/:id
   * Acceso: Solo ADMIN
   */
  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAreaDto: UpdateAreaDto,
  ) {
    return this.areasService.update(id, updateAreaDto);
  }

  /**
   * Desactivar un área
   * DELETE /api/areas/:id/deactivate
   * Acceso: Solo ADMIN
   */
  @Delete(':id/deactivate')
  @Roles('ADMIN')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.areasService.deactivate(id);
  }

  /**
   * Activar un área
   * PATCH /api/areas/:id/activate
   * Acceso: Solo ADMIN
   */
  @Patch(':id/activate')
  @Roles('ADMIN')
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.areasService.activate(id);
  }

  /**
   * Eliminar permanentemente un área (solo desarrollo)
   * DELETE /api/areas/:id
   * Acceso: Solo ADMIN
   */
  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.areasService.remove(id);
  }
}

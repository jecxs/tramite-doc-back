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
import { RolesService } from './roles.service';
import { CreateRolDto } from './dto/create-rol.dto';
import { UpdateRolDto } from './dto/update-rol.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  /**
   * Crear un nuevo rol
   * POST /api/roles
   * Acceso: Solo ADMIN
   */
  @Post()
  @Roles('ADMIN')
  create(@Body() createRolDto: CreateRolDto) {
    return this.rolesService.create(createRolDto);
  }

  /**
   * Obtener todos los roles
   * GET /api/roles?includeInactive=false
   * Acceso: ADMIN, RESP (todos pueden ver los roles)
   */
  @Get()
  @Roles('ADMIN', 'RESP')
  findAll(@Query('includeInactive', ParseBoolPipe) includeInactive?: boolean) {
    return this.rolesService.findAll(includeInactive);
  }

  /**
   * Obtener un rol por ID
   * GET /api/roles/:id
   * Acceso: ADMIN, RESP
   */
  @Get(':id')
  @Roles('ADMIN', 'RESP')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.findOne(id);
  }

  /**
   * Obtener usuarios asignados a un rol
   * GET /api/roles/:id/users
   * Acceso: Solo ADMIN
   */
  @Get(':id/users')
  @Roles('ADMIN')
  getUsersByRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.getUsersByRole(id);
  }

  /**
   * Obtener un rol por código
   * GET /api/roles/codigo/:codigo
   * Acceso: ADMIN, RESP
   */
  @Get('codigo/:codigo')
  @Roles('ADMIN', 'RESP')
  findByCodigo(@Param('codigo') codigo: string) {
    return this.rolesService.findByCodigo(codigo);
  }

  /**
   * Actualizar un rol
   * PATCH /api/roles/:id
   * Acceso: Solo ADMIN
   */
  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRolDto: UpdateRolDto,
  ) {
    return this.rolesService.update(id, updateRolDto);
  }

  /**
   * Desactivar un rol
   * DELETE /api/roles/:id/deactivate
   * Acceso: Solo ADMIN
   */
  @Delete(':id/deactivate')
  @Roles('ADMIN')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.deactivate(id);
  }

  /**
   * Activar un rol
   * PATCH /api/roles/:id/activate
   * Acceso: Solo ADMIN
   */
  @Patch(':id/activate')
  @Roles('ADMIN')
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.activate(id);
  }

  /**
   * Eliminar permanentemente un rol (solo desarrollo)
   * DELETE /api/roles/:id
   * Acceso: Solo ADMIN
   */
  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.remove(id);
  }
}
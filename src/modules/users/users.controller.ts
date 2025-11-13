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
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FilterUserDto } from './dto/filter-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Crear un nuevo usuario
   * POST /api/users
   * Acceso: Solo ADMIN
   */
  @Post()
  @Roles('ADMIN')
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  /**
   * Obtener todos los usuarios con filtros opcionales
   * GET /api/users?search=juan&id_area=xxx&id_rol=xxx&activo=true
   * Acceso: ADMIN, RESP (pero RESP solo ve usuarios de su área)
   */
  @Get()
  @Roles('ADMIN', 'RESP')
  async findAll(
    @Query() filterDto: FilterUserDto,
    @CurrentUser() currentUser: any,
  ) {
    // Si es RESP y no es ADMIN, solo puede ver usuarios de su área
    if (
      currentUser.roles.includes('RESP') &&
      !currentUser.roles.includes('ADMIN')
    ) {
      filterDto.id_area = currentUser.id_area;
    }

    return this.usersService.findAll(filterDto);
  }

  /**
   * Obtener estadísticas de usuarios
   * GET /api/users/statistics
   * Acceso: Solo ADMIN
   */
  @Get('statistics')
  @Roles('ADMIN')
  getStatistics() {
    return this.usersService.getStatistics();
  }

  /**
   * Obtener un usuario por ID
   * GET /api/users/:id
   * Acceso: ADMIN puede ver cualquiera, RESP solo de su área, TRAB solo a sí mismo
   */
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: any,
  ) {
    const usuario = await this.usersService.findOne(id);

    // ADMIN puede ver cualquier usuario
    if (currentUser.roles.includes('ADMIN')) {
      return usuario;
    }

    // RESP puede ver usuarios de su área
    if (
      currentUser.roles.includes('RESP') &&
      usuario.id_area === currentUser.id_area
    ) {
      return usuario;
    }

    // Cualquier usuario puede ver su propio perfil
    if (currentUser.id_usuario === id) {
      return usuario;
    }

    // Si no cumple ninguna condición, no tiene permiso
    throw new Error('No tiene permisos para ver este usuario');
  }

  /**
   * Actualizar un usuario
   * PATCH /api/users/:id
   * Acceso: Solo ADMIN
   */
  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  /**
   * Desactivar un usuario (soft delete)
   * DELETE /api/users/:id/deactivate
   * Acceso: Solo ADMIN
   */
  @Delete(':id/deactivate')
  @Roles('ADMIN')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.deactivate(id);
  }

  /**
   * Activar un usuario
   * PATCH /api/users/:id/activate
   * Acceso: Solo ADMIN
   */
  @Patch(':id/activate')
  @Roles('ADMIN')
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.activate(id);
  }

  /**
   * Eliminar permanentemente un usuario (solo desarrollo)
   * DELETE /api/users/:id
   * Acceso: Solo ADMIN
   */
  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}

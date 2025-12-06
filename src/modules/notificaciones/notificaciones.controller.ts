import {
  Controller,
  Get,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { FilterNotificacionDto } from './dto/filter-notificacion.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ERoles } from 'src/common/enums/ERoles.enum';

@Controller('notificaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  /**
   * Obtener todas las notificaciones del usuario actual
   * GET /api/notificaciones
   * Acceso: Todos los usuarios autenticados
   */
  @Get()
  @Roles(ERoles.ADMIN, ERoles.RESP, ERoles.TRAB)
  findAll(
    @CurrentUser('id_usuario') userId: string,
    @Query() filterDto: FilterNotificacionDto,
  ) {
    return this.notificacionesService.findAll(userId, filterDto);
  }

  /**
   * Obtener notificaciones no leídas
   * GET /api/notificaciones/unread
   * Acceso: Todos los usuarios autenticados
   */
  @Get('unread')
  @Roles(ERoles.ADMIN, ERoles.RESP, ERoles.TRAB)
  findUnread(@CurrentUser('id_usuario') userId: string) {
    return this.notificacionesService.findUnread(userId);
  }

  /**
   * Obtener contador de notificaciones no leídas
   * GET /api/notificaciones/unread/count
   * Acceso: Todos los usuarios autenticados
   */
  @Get('unread/count')
  @Roles(ERoles.ADMIN, ERoles.RESP, ERoles.TRAB)
  getUnreadCount(@CurrentUser('id_usuario') userId: string) {
    return this.notificacionesService.getUnreadCount(userId);
  }

  /**
   * Obtener estadísticas de notificaciones
   * GET /api/notificaciones/statistics
   * Acceso: Todos los usuarios autenticados
   */
  @Get('statistics')
  @Roles(ERoles.ADMIN, ERoles.RESP, ERoles.TRAB)
  getStatistics(@CurrentUser('id_usuario') userId: string) {
    return this.notificacionesService.getStatistics(userId);
  }

  /**
   * Obtener una notificación por ID
   * GET /api/notificaciones/:id
   * Acceso: Todos los usuarios autenticados (solo pueden ver las suyas)
   */
  @Get(':id')
  @Roles(ERoles.ADMIN, ERoles.RESP, ERoles.TRAB)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id_usuario') userId: string,
  ) {
    return this.notificacionesService.findOne(id, userId);
  }

  /**
   * Marcar una notificación como leída
   * PATCH /api/notificaciones/:id/read
   * Acceso: Todos los usuarios autenticados (solo pueden marcar las suyas)
   */
  @Patch(':id/read')
  @Roles(ERoles.ADMIN, ERoles.RESP, ERoles.TRAB)
  markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id_usuario') userId: string,
  ) {
    return this.notificacionesService.markAsRead(id, userId);
  }

  /**
   * Marcar todas las notificaciones como leídas
   * PATCH /api/notificaciones/read-all
   * Acceso: Todos los usuarios autenticados
   */
  @Patch('read-all')
  @Roles(ERoles.ADMIN, ERoles.RESP, ERoles.TRAB)
  markAllAsRead(@CurrentUser('id_usuario') userId: string) {
    return this.notificacionesService.markAllAsRead(userId);
  }

  /**
   * Limpiar notificaciones antiguas (solo ADMIN)
   * DELETE /api/notificaciones/cleanup
   * Acceso: Solo ADMIN
   */
  @Delete('cleanup')
  @Roles(ERoles.ADMIN)
  deleteOldNotifications() {
    return this.notificacionesService.deleteOldNotifications();
  }
}

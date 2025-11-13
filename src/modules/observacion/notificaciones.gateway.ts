import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3001', 'http://localhost:3000'],
    credentials: true,
  },
})
export class NotificacionesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificacionesGateway.name);

  // Mapa para asociar usuarios con sus sockets
  private userSockets = new Map<string, string[]>();

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);

    // Obtener el userId del query o auth
    const userId = client.handshake.query.userId as string;

    if (userId) {
      // Agregar socket al usuario
      const sockets = this.userSockets.get(userId) || [];
      sockets.push(client.id);
      this.userSockets.set(userId, sockets);

      this.logger.log(`Usuario ${userId} asociado al socket ${client.id}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);

    // Remover socket del mapa
    for (const [userId, sockets] of this.userSockets.entries()) {
      const index = sockets.indexOf(client.id);
      if (index > -1) {
        sockets.splice(index, 1);
        if (sockets.length === 0) {
          this.userSockets.delete(userId);
        } else {
          this.userSockets.set(userId, sockets);
        }
        this.logger.log(`Socket ${client.id} removido del usuario ${userId}`);
        break;
      }
    }
  }

  /**
   * Enviar notificación a un usuario específico
   */
  enviarNotificacionAUsuario(userId: string, notificacion: any) {
    const sockets = this.userSockets.get(userId);

    if (sockets && sockets.length > 0) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit('nueva_observacion', notificacion);
      });
      this.logger.log(`Notificación enviada al usuario ${userId}`);
      return true;
    } else {
      this.logger.warn(`Usuario ${userId} no está conectado`);
      return false;
    }
  }

  /**
   * Enviar notificación cuando una observación es resuelta
   */
  enviarNotificacionResolucion(userId: string, notificacion: any) {
    const sockets = this.userSockets.get(userId);

    if (sockets && sockets.length > 0) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit('observacion_resuelta', notificacion);
      });
      this.logger.log(
        `Notificación de resolución enviada al usuario ${userId}`,
      );
      return true;
    } else {
      this.logger.warn(`Usuario ${userId} no está conectado`);
      return false;
    }
  }

  /**
   * Broadcast a todos los usuarios conectados (opcional)
   */
  enviarBroadcast(evento: string, data: any) {
    this.server.emit(evento, data);
    this.logger.log(`Broadcast enviado: ${evento}`);
  }
}

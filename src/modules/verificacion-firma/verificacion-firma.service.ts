import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/services/email.service';

@Injectable()
export class VerificacionFirmaService {
  private readonly logger = new Logger(VerificacionFirmaService.name);
  private readonly CODIGO_EXPIRACION_MINUTOS = parseInt(
    process.env.CODIGO_VERIFICACION_EXPIRACION_MINUTOS || '5',
  );
  private readonly MAX_INTENTOS = parseInt(
    process.env.CODIGO_VERIFICACION_MAX_INTENTOS || '5',
  );
  private readonly BLOQUEO_MINUTOS = parseInt(
    process.env.CODIGO_VERIFICACION_BLOQUEO_MINUTOS || '15',
  );

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  /**
   * Generar y enviar código de verificación por email
   */
  async generarYEnviarCodigo(
    idTramite: string,
    userId: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<{
    mensaje: string;
    expira_en: Date;
    email_enviado_a: string;
  }> {
    // 1. Verificar que el trámite existe y el usuario puede firmarlo
    const tramite = await this.prisma.tramite.findUnique({
      where: { id_tramite: idTramite },
      include: {
        documento: {
          include: {
            tipo: true,
          },
        },
        receptor: {
          select: {
            nombres: true,
            apellidos: true,
            correo: true,
          },
        },
      },
    });

    if (!tramite) {
      throw new NotFoundException(`Trámite con ID ${idTramite} no encontrado`);
    }

    // Solo el receptor puede solicitar código
    if (tramite.id_receptor !== userId) {
      throw new ForbiddenException(
        'Solo el receptor del trámite puede solicitar el código de verificación',
      );
    }

    // Verificar que el trámite requiere firma
    if (!tramite.requiere_firma) {
      throw new BadRequestException('Este trámite no requiere firma electrónica');
    }

    // Verificar que está en estado LEIDO
    if (tramite.estado !== 'LEIDO') {
      throw new BadRequestException(
        'El trámite debe estar en estado LEIDO para poder firmarlo',
      );
    }

    // 2. Verificar si el usuario está bloqueado temporalmente
    await this.verificarBloqueoTemporal(userId);

    // 3. Invalidar códigos anteriores no usados del mismo trámite
    await this.prisma.codigoVerificacionFirma.updateMany({
      where: {
        id_tramite: idTramite,
        id_usuario: userId,
        usado: false,
      },
      data: {
        usado: true, // Marcarlos como usados para invalidarlos
      },
    });

    // 4. Generar código de 6 dígitos
    const codigo = this.generarCodigoAleatorio();

    // 5. Calcular fecha de expiración
    const expiraEn = new Date();
    expiraEn.setMinutes(expiraEn.getMinutes() + this.CODIGO_EXPIRACION_MINUTOS);

    // 6. Guardar en base de datos
    const codigoRegistro = await this.prisma.codigoVerificacionFirma.create({
      data: {
        id_tramite: idTramite,
        id_usuario: userId,
        codigo: codigo,
        email_destinatario: tramite.receptor.correo,
        expira_en: expiraEn,
        ip_solicitud: ipAddress,
        user_agent: userAgent,
      },
    });

    // 7. Enviar email con el código
    try {
      await this.emailService.enviarCodigoVerificacionFirma(
        tramite.receptor.correo,
        `${tramite.receptor.nombres} ${tramite.receptor.apellidos}`,
        codigo,
        tramite.documento.titulo,
        tramite.codigo,
        this.CODIGO_EXPIRACION_MINUTOS,
      );

      this.logger.log(
        `Código de verificación enviado a ${tramite.receptor.correo} para trámite ${tramite.codigo}`,
      );
    } catch (error) {
      // Si falla el envío del email, eliminar el código de la BD
      await this.prisma.codigoVerificacionFirma.delete({
        where: { id_codigo: codigoRegistro.id_codigo },
      });

      this.logger.error(`Error al enviar email: ${error.message}`);
      throw new BadRequestException(
        'Error al enviar el código de verificación. Por favor, inténtelo nuevamente.',
      );
    }

    // 8. Ocultar parte del email para privacidad
    const emailCensurado = this.censurarEmail(tramite.receptor.correo);

    return {
      mensaje: 'Código de verificación enviado exitosamente',
      expira_en: expiraEn,
      email_enviado_a: emailCensurado,
    };
  }

  /**
   * Validar código de verificación ingresado por el usuario
   */
  async validarCodigo(
    idTramite: string,
    userId: string,
    codigoIngresado: string,
    ipAddress: string,
  ): Promise<boolean> {
    // 1. Verificar bloqueo temporal
    await this.verificarBloqueoTemporal(userId);

    // 2. Buscar el código más reciente y válido
    const codigoRegistro = await this.prisma.codigoVerificacionFirma.findFirst({
      where: {
        id_tramite: idTramite,
        id_usuario: userId,
        usado: false,
      },
      orderBy: {
        fecha_creacion: 'desc',
      },
    });

    if (!codigoRegistro) {
      throw new BadRequestException(
        'No hay un código de verificación válido. Solicita uno nuevo.',
      );
    }

    // 3. Verificar si el código expiró
    if (new Date() > codigoRegistro.expira_en) {
      await this.prisma.codigoVerificacionFirma.update({
        where: { id_codigo: codigoRegistro.id_codigo },
        data: { usado: true },
      });

      throw new BadRequestException(
        'El código ha expirado. Solicita uno nuevo.',
      );
    }

    // 4. Verificar el código
    if (codigoRegistro.codigo !== codigoIngresado.trim()) {
      // Incrementar intentos fallidos
      const intentosActualizados = codigoRegistro.intentos_fallidos + 1;

      // Si alcanzó el máximo de intentos, bloquear temporalmente
      if (intentosActualizados >= this.MAX_INTENTOS) {
        const bloqueadoHasta = new Date();
        bloqueadoHasta.setMinutes(bloqueadoHasta.getMinutes() + this.BLOQUEO_MINUTOS);

        await this.prisma.codigoVerificacionFirma.update({
          where: { id_codigo: codigoRegistro.id_codigo },
          data: {
            intentos_fallidos: intentosActualizados,
            bloqueado_hasta: bloqueadoHasta,
            usado: true,
          },
        });

        // Enviar email de notificación de bloqueo
        const usuario = await this.prisma.usuario.findUnique({
          where: { id_usuario: userId },
        });

        if (usuario) {
          await this.emailService.enviarNotificacionBloqueoTemporal(
            usuario.correo,
            `${usuario.nombres} ${usuario.apellidos}`,
            this.BLOQUEO_MINUTOS,
          );
        }

        this.logger.warn(
          `Usuario ${userId} bloqueado temporalmente por ${this.BLOQUEO_MINUTOS} minutos`,
        );

        throw new ForbiddenException(
          `Demasiados intentos fallidos. Tu cuenta ha sido bloqueada temporalmente por ${this.BLOQUEO_MINUTOS} minutos.`,
        );
      }

      // Actualizar intentos fallidos
      await this.prisma.codigoVerificacionFirma.update({
        where: { id_codigo: codigoRegistro.id_codigo },
        data: {
          intentos_fallidos: intentosActualizados,
        },
      });

      const intentosRestantes = this.MAX_INTENTOS - intentosActualizados;

      throw new BadRequestException(
        `Código incorrecto. Te quedan ${intentosRestantes} ${intentosRestantes === 1 ? 'intento' : 'intentos'}.`,
      );
    }

    // 5. Código válido - Marcar como usado
    await this.prisma.codigoVerificacionFirma.update({
      where: { id_codigo: codigoRegistro.id_codigo },
      data: {
        usado: true,
        fecha_usado: new Date(),
      },
    });

    this.logger.log(
      `Código verificado exitosamente para usuario ${userId} en trámite ${idTramite}`,
    );

    return true;
  }

  /**
   * Verificar si el usuario está bloqueado temporalmente
   */
  private async verificarBloqueoTemporal(userId: string): Promise<void> {
    const codigoBloqueado = await this.prisma.codigoVerificacionFirma.findFirst({
      where: {
        id_usuario: userId,
        bloqueado_hasta: {
          gt: new Date(),
        },
      },
      orderBy: {
        bloqueado_hasta: 'desc',
      },
    });

    if (codigoBloqueado) {
      const minutosRestantes = Math.ceil(
        (codigoBloqueado.bloqueado_hasta.getTime() - Date.now()) / (1000 * 60),
      );

      throw new ForbiddenException(
        `Tu cuenta está bloqueada temporalmente. Podrás intentar nuevamente en ${minutosRestantes} ${minutosRestantes === 1 ? 'minuto' : 'minutos'}.`,
      );
    }
  }

  /**
   * Generar código aleatorio de 6 dígitos
   */
  private generarCodigoAleatorio(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Censurar parte del email para privacidad
   * Ejemplo: juan.perez@universidad.edu.pe -> j***z@universidad.edu.pe
   */
  private censurarEmail(email: string): string {
    const [usuario, dominio] = email.split('@');
    if (usuario.length <= 2) {
      return `${usuario[0]}***@${dominio}`;
    }
    const primerCaracter = usuario[0];
    const ultimoCaracter = usuario[usuario.length - 1];
    return `${primerCaracter}***${ultimoCaracter}@${dominio}`;
  }

  /**
   * Obtener estadísticas de códigos de verificación (solo ADMIN)
   */
  async getEstadisticas() {
    const [total, usados, expirados, bloqueados] = await Promise.all([
      this.prisma.codigoVerificacionFirma.count(),
      this.prisma.codigoVerificacionFirma.count({ where: { usado: true } }),
      this.prisma.codigoVerificacionFirma.count({
        where: {
          usado: false,
          expira_en: { lt: new Date() },
        },
      }),
      this.prisma.codigoVerificacionFirma.count({
        where: {
          bloqueado_hasta: { gt: new Date() },
        },
      }),
    ]);

    return {
      total_codigos_generados: total,
      codigos_usados: usados,
      codigos_expirados: expirados,
      usuarios_bloqueados_actualmente: bloqueados,
      tasa_exito: total > 0 ? ((usados / total) * 100).toFixed(2) + '%' : '0%',
    };
  }
}
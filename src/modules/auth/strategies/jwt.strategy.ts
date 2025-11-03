import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_SECRET ||
        'tu-secreto-super-seguro-cambiar-en-produccion',
    });
  }

  async validate(payload: JwtPayload) {
    // Verificar que el usuario todavía existe y está activo
    const usuario = await this.prisma.usuario.findUnique({
      where: { id_usuario: payload.sub },
      include: {
        area: true,
        roles: {
          include: {
            rol: true,
          },
        },
      },
    });

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario no autorizado o inactivo');
    }

    // Retornamos el usuario completo que se adjuntará a request.user
    return {
      id_usuario: usuario.id_usuario,
      dni: usuario.dni,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      correo: usuario.correo,
      id_area: usuario.id_area,
      area: usuario.area,
      roles: usuario.roles.map((ur) => ur.rol.codigo),
    };
  }
}

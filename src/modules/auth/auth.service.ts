import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    // 1. Buscar usuario por correo
    const usuario = await this.prisma.usuario.findUnique({
      where: { correo: loginDto.correo },
      include: {
        area: true,
        roles: {
          include: {
            rol: true,
          },
        },
      },
    });

    // 2. Verificar que el usuario existe
    if (!usuario) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    // 3. Verificar que el usuario está activo
    if (!usuario.activo) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    // 4. Verificar la contraseña
    const passwordValida = await bcrypt.compare(
      loginDto.password,
      usuario.password,
    );

    if (!passwordValida) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    // 5. Generar el JWT
    const roles = usuario.roles.map((ur) => ur.rol.codigo);
    const payload: JwtPayload = {
      sub: usuario.id_usuario,
      correo: usuario.correo,
      dni: usuario.dni,
      roles: roles,
      id_area: usuario.id_area,
      nombre_completo: `${usuario.nombres} ${usuario.apellidos}`,
    };

    const access_token = this.jwtService.sign(payload);

    // 6. Retornar la respuesta
    return {
      access_token,
      token_type: 'Bearer',
      expires_in: 3600, // 1 hora en segundos
      user: {
        id_usuario: usuario.id_usuario,
        dni: usuario.dni,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        correo: usuario.correo,
        roles: roles,
        area: {
          id_area: usuario.area.id_area,
          nombre: usuario.area.nombre,
        },
      },
    };
  }

  async validateUser(id_usuario: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id_usuario },
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
      return null;
    }

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

  async getProfile(id_usuario: string) {
    return this.validateUser(id_usuario);
  }
}

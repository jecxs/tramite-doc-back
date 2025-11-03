import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Endpoint de login
   * POST /auth/login
   */
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * Endpoint para obtener el perfil del usuario autenticado
   * GET /auth/profile
   * Requiere JWT token en el header: Authorization: Bearer <token>
   */
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@CurrentUser('id_usuario') id_usuario: string) {
    return this.authService.getProfile(id_usuario);
  }

  /**
   * Endpoint para verificar si el token es válido
   * GET /auth/verify
   */
  @UseGuards(JwtAuthGuard)
  @Get('verify')
  async verifyToken(@CurrentUser() user: any) {
    return {
      valid: true,
      user,
    };
  }
}

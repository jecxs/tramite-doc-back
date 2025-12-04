import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { config } from './config';

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

BigInt.prototype.toJSON = function (this: bigint): string {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // src/main.ts - Actualizar configuración CORS
  app.enableCors({
    origin: config.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Disposition'],
  });

  // Habilitar validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Prefijo global para todas las rutas
  app.setGlobalPrefix('api');

  await app.listen(config.PORT);
  console.log(`Servidor corriendo en: http://localhost:${config.PORT}`);
  console.log(`API disponible en: http://localhost:${config.PORT}/api`);
}

void bootstrap();

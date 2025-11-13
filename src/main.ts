import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cors para Next.js
  app.enableCors({
    origin: ['http://localhost:3001', 'http://localhost:3000'],
    credentials: true,
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

  await app.listen(process.env.PORT ?? 3000);
  console.log(
    `Servidor corriendo en: http://localhost:${process.env.PORT ?? 3000}`,
  );
  console.log(
    `API disponible en: http://localhost:${process.env.PORT ?? 3000}/api`,
  );
}
bootstrap();

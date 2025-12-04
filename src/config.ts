import 'dotenv/config';
import { plainToInstance } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  IsEnum,
  validateSync,
  IsNotEmpty,
  Min,
  Max,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsNotEmpty()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsArray()
  @IsString({ each: true })
  CORS_ORIGINS: string[] = [];

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string = '';

  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string = '';

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN: string = '1h';

  @IsString()
  @IsOptional()
  R2_ENDPOINT?: string;

  @IsString()
  @IsOptional()
  R2_ACCOUNT_ID?: string;

  @IsString()
  @IsOptional()
  R2_ACCESS_KEY_ID?: string;

  @IsString()
  @IsOptional()
  R2_SECRET_ACCESS_KEY?: string;

  @IsString()
  @IsOptional()
  R2_BUCKET_NAME?: string;

  @IsString()
  BREVO_SENDER_EMAIL?: string;

  @IsString()
  BREVO_API_KEY?: string;

  @IsString()
  BREVO_SENDER_NAME;

  @IsString()
  MAX_FILE_SIZE_MB;

  @IsString()
  CODIGO_VERIFICACION_EXPIRACION_MINUTOS;

  @IsString()
  CODIGO_VERIFICACION_MAX_INTENTOS;

  @IsString()
  CODIGO_VERIFICACION_BLOQUEO_MINUTOS;
}

function validateConfig(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors
      .map((error) => {
        const constraints = error.constraints
          ? Object.values(error.constraints).join(', ')
          : 'Unknown error';
        return `${error.property}: ${constraints}`;
      })
      .join('\n');

    throw new Error(`❌ Config validation error:\n${errorMessages}`);
  }

  return validatedConfig;
}

// Preparar los datos de configuración
const configData = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 3000),
  CORS_ORIGINS: process.env.CORS_ORIGINS?.split(',').map((origin) =>
    origin.trim(),
  ) || ['http://localhost:3001', 'http://localhost:3000'],
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET:
    process.env.JWT_SECRET ?? 'tu-secreto-super-seguro-cambiar-en-produccion',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '1h',
  R2_ENDPOINT: process.env.R2_ENDPOINT,
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  BREVO_SENDER_EMAIL:
    process.env.BREVO_SENDER_EMAIL || 'noreply@sistema.edu.pe',
  BREVO_API_KEY: process.env.BREVO_API_KEY,
  BREVO_SENDER_NAME: process.env.BREVO_SENDER_NAME || 'Sistema de Trámites',
  MAX_FILE_SIZE_MB: process.env.MAX_FILE_SIZE_MB || '10',
  CODIGO_VERIFICACION_EXPIRACION_MINUTOS:
    process.env.CODIGO_VERIFICACION_EXPIRACION_MINUTOS || '5',
  CODIGO_VERIFICACION_MAX_INTENTOS:
    process.env.CODIGO_VERIFICACION_MAX_INTENTOS || '5',
  CODIGO_VERIFICACION_BLOQUEO_MINUTOS:
    process.env.CODIGO_VERIFICACION_BLOQUEO_MINUTOS || '15',
};

export const config: Readonly<EnvironmentVariables> =
  validateConfig(configData);

export type Config = EnvironmentVariables;

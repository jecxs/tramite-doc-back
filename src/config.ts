import 'dotenv/config';
import env from 'env-var';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

type AppConfig = {
  NODE_ENV: Environment;
  PORT: number;
  CORS_ORIGINS: string[];
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  R2_ENDPOINT?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  BREVO_SENDER_EMAIL?: string;
  BREVO_API_KEY?: string;
  BREVO_SENDER_NAME?: string;
  MAX_FILE_SIZE_MB: string;
  CODIGO_VERIFICACION_EXPIRACION_MINUTOS: string;
  CODIGO_VERIFICACION_MAX_INTENTOS: string;
  CODIGO_VERIFICACION_BLOQUEO_MINUTOS: string;
};

const corsDefaults = 'http://localhost:3001,http://localhost:3000';

export const config: Readonly<AppConfig> = {
  NODE_ENV:
    (env
      .get('NODE_ENV')
      .default('development')
      .asEnum(Object.values(Environment)) as Environment) ?? Environment.Development,
  PORT: env.get('PORT').default('3000').asIntPositive(),
  CORS_ORIGINS: (env
    .get('CORS_ORIGINS')
    .default(corsDefaults)
    .asArray(',') || corsDefaults.split(','))
    .map((origin) => origin.trim()),
  DATABASE_URL: env.get('DATABASE_URL').required().asString(),
  JWT_SECRET: env
    .get('JWT_SECRET')
    .default('tu-secreto-super-seguro-cambiar-en-produccion')
    .asString(),
  JWT_EXPIRES_IN: env.get('JWT_EXPIRES_IN').default('1h').asString(),
  R2_ENDPOINT: env.get('R2_ENDPOINT').asString(),
  R2_ACCOUNT_ID: env.get('R2_ACCOUNT_ID').asString(),
  R2_ACCESS_KEY_ID: env.get('R2_ACCESS_KEY_ID').asString(),
  R2_SECRET_ACCESS_KEY: env.get('R2_SECRET_ACCESS_KEY').asString(),
  R2_BUCKET_NAME: env.get('R2_BUCKET_NAME').asString(),
  BREVO_SENDER_EMAIL: env
    .get('BREVO_SENDER_EMAIL')
    .default('noreply@sistema.edu.pe')
    .asString(),
  BREVO_API_KEY: env.get('BREVO_API_KEY').asString(),
  BREVO_SENDER_NAME: env
    .get('BREVO_SENDER_NAME')
    .default('Sistema de Trámites')
    .asString(),
  MAX_FILE_SIZE_MB: env.get('MAX_FILE_SIZE_MB').default('10').asString(),
  CODIGO_VERIFICACION_EXPIRACION_MINUTOS: env
    .get('CODIGO_VERIFICACION_EXPIRACION_MINUTOS')
    .default('5')
    .asString(),
  CODIGO_VERIFICACION_MAX_INTENTOS: env
    .get('CODIGO_VERIFICACION_MAX_INTENTOS')
    .default('5')
    .asString(),
  CODIGO_VERIFICACION_BLOQUEO_MINUTOS: env
    .get('CODIGO_VERIFICACION_BLOQUEO_MINUTOS')
    .default('15')
    .asString(),
};

export type Config = AppConfig;

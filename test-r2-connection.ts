// test-r2-connection.ts
import * as dotenv from 'dotenv';
dotenv.config();

import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';

// Obtener variables de entorno (asegúrate de que R2_BUCKET_NAME esté definido)
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME; // ¡Nueva variable!

if (!R2_BUCKET_NAME) {
  console.error("❌ ERROR: La variable R2_BUCKET_NAME no está definida.");
  process.exit(1);
}

const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
  },
});

async function testConnection() {
  try {
    // 💡 Usamos HeadBucketCommand para verificar si el bucket existe y es accesible
    const command = new HeadBucketCommand({
      Bucket: R2_BUCKET_NAME,
    });

    // Si la promesa se resuelve (no lanza error), la conexión y el acceso son correctos.
    await r2Client.send(command);

    console.log(`✅ Conexión exitosa a R2.`);
    console.log(`Bucket verificado: **${R2_BUCKET_NAME}**.`);

  } catch (error) {
    console.error('❌ Error al conectar con R2:', error);
    // Si la respuesta es 404 (Not Found), el bucket no existe
    // Si la respuesta es 403 (Forbidden), las credenciales no tienen permiso sobre ESE bucket
  }
}

testConnection();
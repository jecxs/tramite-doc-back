import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
    console.log('Conexión a la base de datos establecida');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('Desconexión de la base de datos');
  }

  // Método helper para limpiar la base de datos (útil para testing)
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('No se puede limpiar la base de datos en producción');
    }

    const models = Reflect.ownKeys(this).filter(
      (key) =>
        typeof key === 'string' &&
        key[0] !== '_' &&
        key !== '$connect' &&
        key !== '$disconnect',
    );

    return Promise.all(
      models.map((modelKey) => {
        return this[modelKey as string].deleteMany();
      }),
    );
  }
}

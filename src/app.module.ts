import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { AreasModule } from './modules/areas/areas.module';
import { DocumentosModule } from './modules/documents/documents.module';
import { TramitesModule } from './modules/tramite/tramites.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    RolesModule,
    AreasModule,
    DocumentosModule,
    TramitesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

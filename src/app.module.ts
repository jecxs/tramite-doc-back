import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { AreasModule } from './modules/areas/areas.module';
import { DocumentosModule } from './modules/documents/documents.module';
import { TramitesModule } from './modules/tramite/tramites.module';
import { ObservacionesModule } from './modules/observacion/observaciones.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { TipoDocumentoModule } from './modules/document-type/tipo-documento.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    RolesModule,
    AreasModule,
    DocumentosModule,
    TramitesModule,
    ObservacionesModule,
    NotificacionesModule,
    TipoDocumentoModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

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
import { FirmaElectronicaModule } from './modules/firma-electronica/firma-electronica.module';
import { RespuestaTramiteModule } from './modules/respuesta-tramite/respuesta-tramite.module';
import { VerificacionFirmaModule } from './modules/verificacion-firma/verificacion-firma.module';

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
    FirmaElectronicaModule,
    RespuestaTramiteModule,
    VerificacionFirmaModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

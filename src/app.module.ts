import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { AreasService } from './modules/areas/areas.service';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, RolesModule, AreasService],
  controllers: [],
  providers: [],
})
export class AppModule {}

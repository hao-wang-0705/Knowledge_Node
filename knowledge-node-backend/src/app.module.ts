import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { NodesModule } from './modules/nodes/nodes.module';
import { NotebooksModule } from './modules/notebooks/notebooks.module';
import { TagsModule } from './modules/tags/tags.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    NodesModule,
    NotebooksModule,
    TagsModule,
    UsersModule,
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { NodesModule } from '../nodes/nodes.module';

@Module({
  imports: [PrismaModule, NodesModule],
  controllers: [AIController],
  providers: [AIService],
  exports: [AIService],
})
export class AIModule {}

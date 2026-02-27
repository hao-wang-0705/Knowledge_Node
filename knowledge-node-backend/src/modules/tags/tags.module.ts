import { Module } from '@nestjs/common';
import { TagsService } from './tags.service';
import { SupertagsController, TagsController } from './tags.controller';

@Module({
  controllers: [SupertagsController, TagsController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}

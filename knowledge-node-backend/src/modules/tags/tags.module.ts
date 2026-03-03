import { Module } from '@nestjs/common';
import { TagsService } from './tags.service';
import { SupertagsController, TagsController, InternalTagsController } from './tags.controller';

@Module({
  controllers: [SupertagsController, TagsController, InternalTagsController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}

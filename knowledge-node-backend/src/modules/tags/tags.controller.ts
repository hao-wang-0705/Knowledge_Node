import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { TagsService } from './tags.service';
import {
  CreateSupertagDto,
  UpdateSupertagDto,
  BatchCreateSupertagsDto,
  SupertagResponseDto,
} from './dto/tag.dto';

@ApiTags('supertags')
@Controller('api/supertags')
export class SupertagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  @ApiOperation({ summary: '创建功能标签' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 201, description: '标签创建成功', type: SupertagResponseDto })
  create(
    @Headers('x-user-id') userId: string,
    @Body() createDto: CreateSupertagDto,
  ) {
    return this.tagsService.createSupertag(userId, createDto);
  }

  @Post('batch')
  @ApiOperation({ summary: '批量创建功能标签' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 201, description: '标签批量创建成功' })
  batchCreate(
    @Headers('x-user-id') userId: string,
    @Body() batchDto: BatchCreateSupertagsDto,
  ) {
    return this.tagsService.batchCreateSupertags(userId, batchDto);
  }

  @Get()
  @ApiOperation({ summary: '获取所有功能标签' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 200, description: '返回标签列表', type: [SupertagResponseDto] })
  findAll(@Headers('x-user-id') userId: string) {
    return this.tagsService.findAllSupertags(userId);
  }

  @Get('category/:categoryId')
  @ApiOperation({ summary: '按分类获取功能标签' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 200, description: '返回标签列表', type: [SupertagResponseDto] })
  findByCategory(
    @Headers('x-user-id') userId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.tagsService.findSupertagsByCategory(userId, categoryId);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个功能标签' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 200, description: '返回标签详情', type: SupertagResponseDto })
  findOne(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string,
  ) {
    return this.tagsService.findOneSupertag(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新功能标签' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 200, description: '标签更新成功', type: SupertagResponseDto })
  update(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateSupertagDto,
  ) {
    return this.tagsService.updateSupertag(userId, id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除功能标签' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 200, description: '标签删除成功' })
  remove(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string,
  ) {
    return this.tagsService.removeSupertag(userId, id);
  }
}

@ApiTags('tags')
@Controller('api/tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get('search')
  @ApiOperation({ summary: '搜索标签' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiQuery({ name: 'q', required: true, description: '搜索关键词' })
  @ApiResponse({ status: 200, description: '返回匹配的标签' })
  search(
    @Headers('x-user-id') userId: string,
    @Query('q') query: string,
  ) {
    return this.tagsService.searchTags(userId, query);
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { TagsService } from './tags.service';
import {
  CreateTagTemplateDto,
  TagTemplateResponseDto,
} from './dto/tag.dto';

/**
 * 系统预置标签 API - 只读接口
 * v3.4: 移除 category 路由，标签不再按分类组织
 */
@ApiTags('supertags')
@Controller('api/supertags')
export class SupertagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @ApiOperation({ summary: '获取所有可用标签（系统预置 + 用户订阅）' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 200, description: '返回标签列表', type: [TagTemplateResponseDto] })
  findAll(@Headers('x-user-id') userId: string) {
    return this.tagsService.findAllTagTemplates(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个标签详情' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 200, description: '返回标签详情', type: TagTemplateResponseDto })
  findOne(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string,
  ) {
    return this.tagsService.findOneTagTemplate(userId, id);
  }
}

/**
 * 标签搜索 API
 */
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

/**
 * 内部管理 API - 仅供管理员/系统调用
 */
@ApiTags('internal-tags')
@Controller('api/internal/tags')
export class InternalTagsController {
  constructor(private readonly tagsService: TagsService) {}

  private assertAdminKey(adminKey: string) {
    const expectedKey = process.env.ADMIN_API_KEY;
    if (!expectedKey) {
      throw new UnauthorizedException('ADMIN_API_KEY 未配置');
    }
    if (adminKey !== expectedKey) {
      throw new UnauthorizedException('Invalid admin key');
    }
  }

  @Post()
  @ApiOperation({ summary: '创建系统预置标签（管理员专用）' })
  @ApiHeader({ name: 'x-admin-key', description: '管理员密钥', required: true })
  @ApiResponse({ status: 201, description: '标签创建成功', type: TagTemplateResponseDto })
  create(
    @Headers('x-admin-key') adminKey: string,
    @Body() createDto: CreateTagTemplateDto,
  ) {
    this.assertAdminKey(adminKey);
    return this.tagsService.createTagTemplate(createDto);
  }

  @Get()
  @ApiOperation({ summary: '获取所有标签模版（管理员专用）' })
  @ApiHeader({ name: 'x-admin-key', description: '管理员密钥', required: true })
  @ApiResponse({ status: 200, description: '返回所有标签模版', type: [TagTemplateResponseDto] })
  findAll(@Headers('x-admin-key') adminKey: string) {
    this.assertAdminKey(adminKey);
    return this.tagsService.findAllTagTemplatesAdmin();
  }
}

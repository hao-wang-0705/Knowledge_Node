import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { TagsService } from './tags.service';
import {
  CreateTagTemplateDto,
  UpdateTagTemplateDto,
  BatchImportTagsDto,
  BatchImportResultDto,
  TagTemplateResponseDto,
} from './dto/tag.dto';
import { InternalAuthGuard } from '../../common/guards/internal-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';

/**
 * 系统预置标签 API - 只读接口
 * v3.4: 移除 category 路由，标签不再按分类组织
 */
@ApiTags('supertags')
@Controller('api/supertags')
@UseGuards(InternalAuthGuard)
@ApiHeader({ name: 'x-user-id', description: '用户ID（由网关注入）', required: true })
@ApiHeader({ name: 'x-internal-api-key', description: '内部网关密钥', required: true })
export class SupertagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @ApiOperation({ summary: '获取所有可用标签（系统预置 + 用户订阅）' })
  @ApiResponse({ status: 200, description: '返回标签列表', type: [TagTemplateResponseDto] })
  findAll(@CurrentUserId() userId: string) {
    return this.tagsService.findAllTagTemplates(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个标签详情' })
  @ApiResponse({ status: 200, description: '返回标签详情', type: TagTemplateResponseDto })
  findOne(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.tagsService.findOneTagTemplate(userId, id);
  }
}

/**
 * 标签搜索 API
 */
@ApiTags('tags')
@Controller('api/tags')
@UseGuards(InternalAuthGuard)
@ApiHeader({ name: 'x-user-id', description: '用户ID（由网关注入）', required: true })
@ApiHeader({ name: 'x-internal-api-key', description: '内部网关密钥', required: true })
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get('search')
  @ApiOperation({ summary: '搜索标签' })
  @ApiQuery({ name: 'q', required: true, description: '搜索关键词' })
  @ApiResponse({ status: 200, description: '返回匹配的标签' })
  search(@CurrentUserId() userId: string, @Query('q') query: string) {
    return this.tagsService.searchTags(userId, query);
  }
}

/**
 * 内部管理 API - 仅供管理员/系统调用
 * v3.5: 新增批量导入、更新、删除功能
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

  @Post('reset')
  @ApiOperation({ summary: '清空所有标签与节点标签信息（管理员专用，用于 v4.2 实体/行动双轨升级）' })
  @ApiHeader({ name: 'x-admin-key', description: '管理员密钥', required: true })
  @ApiResponse({ status: 200, description: '重置结果' })
  reset(
    @Headers('x-admin-key') adminKey: string,
  ) {
    this.assertAdminKey(adminKey);
    return this.tagsService.resetTagsAndNodeTagData();
  }

  @Post('batch')
  @ApiOperation({ summary: '批量导入系统预置标签（管理员专用）' })
  @ApiHeader({ name: 'x-admin-key', description: '管理员密钥', required: true })
  @ApiResponse({ status: 201, description: '批量导入结果', type: BatchImportResultDto })
  batchImport(
    @Headers('x-admin-key') adminKey: string,
    @Body() batchDto: BatchImportTagsDto,
  ) {
    this.assertAdminKey(adminKey);
    return this.tagsService.batchImportTags(batchDto);
  }

  @Get()
  @ApiOperation({ summary: '获取所有标签模版（管理员专用）' })
  @ApiHeader({ name: 'x-admin-key', description: '管理员密钥', required: true })
  @ApiResponse({ status: 200, description: '返回所有标签模版', type: [TagTemplateResponseDto] })
  findAll(@Headers('x-admin-key') adminKey: string) {
    this.assertAdminKey(adminKey);
    return this.tagsService.findAllTagTemplatesAdmin();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个标签详情（管理员专用）' })
  @ApiHeader({ name: 'x-admin-key', description: '管理员密钥', required: true })
  @ApiResponse({ status: 200, description: '返回标签详情', type: TagTemplateResponseDto })
  findOne(
    @Headers('x-admin-key') adminKey: string,
    @Param('id') id: string,
  ) {
    this.assertAdminKey(adminKey);
    // 复用管理员查询方法，不限制 userId
    return this.tagsService.findAllTagTemplatesAdmin().then(tags => {
      const tag = tags.find(t => t.id === id);
      if (!tag) {
        throw new UnauthorizedException(`TagTemplate with ID ${id} not found`);
      }
      return tag;
    });
  }

  @Put(':id')
  @ApiOperation({ summary: '更新系统预置标签（管理员专用）' })
  @ApiHeader({ name: 'x-admin-key', description: '管理员密钥', required: true })
  @ApiResponse({ status: 200, description: '标签更新成功', type: TagTemplateResponseDto })
  update(
    @Headers('x-admin-key') adminKey: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateTagTemplateDto,
  ) {
    this.assertAdminKey(adminKey);
    return this.tagsService.updateTagTemplate(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除系统预置标签（管理员专用，默认软删除）' })
  @ApiHeader({ name: 'x-admin-key', description: '管理员密钥', required: true })
  @ApiQuery({ name: 'hard', required: false, description: '是否硬删除（需无关联节点）' })
  @ApiResponse({ status: 200, description: '标签删除/禁用成功' })
  delete(
    @Headers('x-admin-key') adminKey: string,
    @Param('id') id: string,
    @Query('hard') hard?: string,
  ) {
    this.assertAdminKey(adminKey);
    const hardDelete = hard === 'true';
    return this.tagsService.deleteTagTemplate(id, hardDelete);
  }
}

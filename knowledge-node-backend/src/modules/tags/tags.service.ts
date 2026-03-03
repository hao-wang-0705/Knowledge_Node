import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTagTemplateDto } from './dto/tag.dto';

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  // =============== 用户只读查询方法 ===============

  /**
   * 聚合查询：获取用户可用的所有标签
   * 1. 全局默认标签 (isGlobalDefault = true AND status = 'active')
   * 2. 用户订阅的标签 (UserTagLibrary 关联)
   */
  async findAllTagTemplates(userId: string) {
    const globalTags = await this.prisma.tagTemplate.findMany({
      where: {
        isGlobalDefault: true,
        status: 'active',
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { nodes: true } },
      },
    });

    const userLibrary = await this.prisma.userTagLibrary.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        tagTemplate: {
          include: {
            _count: { select: { nodes: true } },
          },
        },
      },
    });

    const tagMap = new Map<string, any>();
    globalTags.forEach(tag => tagMap.set(tag.id, tag));
    userLibrary.forEach(lib => {
      if (lib.tagTemplate && !tagMap.has(lib.tagTemplate.id)) {
        tagMap.set(lib.tagTemplate.id, lib.tagTemplate);
      }
    });

    return Array.from(tagMap.values()).map(tag => this.toCompatibleFormat(tag));
  }

  /**
   * 获取单个标签详情
   */
  async findOneTagTemplate(userId: string, id: string) {
    const tag = await this.prisma.tagTemplate.findFirst({
      where: { id, status: 'active' },
      include: {
        _count: { select: { nodes: true } },
      },
    });
    if (!tag) {
      throw new NotFoundException(`TagTemplate with ID ${id} not found`);
    }
    return this.toCompatibleFormat(tag);
  }

  /**
   * 搜索标签
   */
  async searchTags(userId: string, query: string) {
    const tags = await this.prisma.tagTemplate.findMany({
      where: {
        status: 'active',
        name: {
          contains: query,
          mode: 'insensitive',
        },
        OR: [
          { isGlobalDefault: true },
          {
            userLibraries: {
              some: {
                userId,
                isActive: true,
              },
            },
          },
        ],
      },
      take: 10,
      include: {
        _count: { select: { nodes: true } },
      },
    });

    return { supertags: tags.map(tag => this.toCompatibleFormat(tag)) };
  }

  // =============== 管理员专用方法 ===============

  /**
   * 创建系统预置标签（管理员专用）
   */
  async createTagTemplate(createDto: CreateTagTemplateDto) {
    const existing = await this.prisma.tagTemplate.findFirst({
      where: { name: createDto.name },
    });

    if (existing) {
      throw new ConflictException(`TagTemplate with name "${createDto.name}" already exists`);
    }

    const tag = await this.prisma.tagTemplate.create({
      data: {
        name: createDto.name,
        color: createDto.color ?? '#6366F1',
        icon: createDto.icon,
        description: createDto.description,
        fieldDefinitions: createDto.fieldDefinitions ?? [],
        isGlobalDefault: createDto.isGlobalDefault ?? true,
        status: createDto.status ?? 'active',
        order: createDto.order ?? 0,
        templateContent: createDto.templateContent,
        creatorId: createDto.creatorId,
      },
      include: {
        _count: { select: { nodes: true } },
      },
    });

    return this.toCompatibleFormat(tag);
  }

  /**
   * 获取所有标签模版（管理员专用，不过滤状态）
   */
  async findAllTagTemplatesAdmin() {
    const tags = await this.prisma.tagTemplate.findMany({
      orderBy: [{ isGlobalDefault: 'desc' }, { order: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { nodes: true } },
      },
    });

    return tags.map(tag => this.toCompatibleFormat(tag));
  }

  // =============== 工具方法 ===============

  private toCompatibleFormat(tag: any) {
    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      icon: tag.icon,
      description: tag.description,
      fieldDefinitions: tag.fieldDefinitions,
      order: tag.order,
      templateContent: tag.templateContent,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
      isGlobalDefault: tag.isGlobalDefault,
      status: tag.status,
      creatorId: tag.creatorId,
      isSystem: tag.isGlobalDefault,
      _count: tag._count,
    };
  }
}

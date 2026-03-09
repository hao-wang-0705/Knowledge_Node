import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTagTemplateDto, UpdateTagTemplateDto, BatchImportTagsDto, BatchImportResultDto } from './dto/tag.dto';

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
      where: {
        id,
        status: 'active',
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

    return { supertags: tags.map((tag) => this.toCompatibleFormat(tag)) };
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
        viewConfig: createDto.viewConfig ?? undefined,
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

  /**
   * 更新系统预置标签（管理员专用）
   * v3.5: 新增
   */
  async updateTagTemplate(id: string, updateDto: UpdateTagTemplateDto) {
    const existing = await this.prisma.tagTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`TagTemplate with ID "${id}" not found`);
    }

    // 如果要更新名称，检查是否与其他标签冲突
    if (updateDto.name && updateDto.name !== existing.name) {
      const nameConflict = await this.prisma.tagTemplate.findFirst({
        where: { name: updateDto.name, id: { not: id } },
      });
      if (nameConflict) {
        throw new ConflictException(`TagTemplate with name "${updateDto.name}" already exists`);
      }
    }

    const tag = await this.prisma.tagTemplate.update({
      where: { id },
      data: {
        ...(updateDto.name !== undefined && { name: updateDto.name }),
        ...(updateDto.color !== undefined && { color: updateDto.color }),
        ...(updateDto.icon !== undefined && { icon: updateDto.icon }),
        ...(updateDto.description !== undefined && { description: updateDto.description }),
        ...(updateDto.fieldDefinitions !== undefined && { fieldDefinitions: updateDto.fieldDefinitions }),
        ...(updateDto.viewConfig !== undefined && { viewConfig: updateDto.viewConfig }),
        ...(updateDto.isGlobalDefault !== undefined && { isGlobalDefault: updateDto.isGlobalDefault }),
        ...(updateDto.status !== undefined && { status: updateDto.status }),
        ...(updateDto.templateContent !== undefined && { templateContent: updateDto.templateContent }),
        ...(updateDto.order !== undefined && { order: updateDto.order }),
      },
      include: {
        _count: { select: { nodes: true } },
      },
    });

    return this.toCompatibleFormat(tag);
  }

  /**
   * 删除系统预置标签（管理员专用）
   * v3.5: 新增，软删除（将 status 设为 deprecated）
   */
  async deleteTagTemplate(id: string, hardDelete = false) {
    const existing = await this.prisma.tagTemplate.findUnique({
      where: { id },
      include: {
        _count: { select: { nodes: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException(`TagTemplate with ID "${id}" not found`);
    }

    if (hardDelete) {
      // 硬删除：检查是否有关联节点
      if (existing._count?.nodes > 0) {
        throw new ConflictException(
          `Cannot hard delete TagTemplate "${existing.name}" with ${existing._count.nodes} associated nodes. Use soft delete instead.`
        );
      }
      await this.prisma.tagTemplate.delete({ where: { id } });
      return { deleted: true, id, name: existing.name };
    }

    // 软删除：设置为 deprecated
    const tag = await this.prisma.tagTemplate.update({
      where: { id },
      data: { status: 'deprecated' },
      include: {
        _count: { select: { nodes: true } },
      },
    });

    return this.toCompatibleFormat(tag);
  }

  /**
   * 批量导入标签（管理员专用）
   * v3.5: 新增，支持事务原子性和 overwrite 策略
   */
  async batchImportTags(batchDto: BatchImportTagsDto): Promise<BatchImportResultDto> {
    const result: BatchImportResultDto = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    // 使用事务保证原子性
    await this.prisma.$transaction(async (tx) => {
      for (const tagDto of batchDto.tags) {
        try {
          const existing = await tx.tagTemplate.findFirst({
            where: { name: tagDto.name },
          });

          if (existing) {
            if (batchDto.overwrite) {
              // 覆盖模式：更新现有标签
              await tx.tagTemplate.update({
                where: { id: existing.id },
                data: {
                  color: tagDto.color ?? existing.color,
                  icon: tagDto.icon ?? existing.icon,
                  description: tagDto.description ?? existing.description,
                  fieldDefinitions: tagDto.fieldDefinitions ?? existing.fieldDefinitions ?? undefined,
                  viewConfig: tagDto.viewConfig !== undefined ? tagDto.viewConfig : (existing as any).viewConfig ?? undefined,
                  isGlobalDefault: tagDto.isGlobalDefault ?? existing.isGlobalDefault,
                  status: tagDto.status ?? existing.status,
                  templateContent: tagDto.templateContent ?? existing.templateContent ?? undefined,
                  order: tagDto.order ?? existing.order,
                },
              });
              result.updated++;
            } else {
              // 非覆盖模式：跳过
              result.skipped++;
            }
          } else {
            // 创建新标签
            await tx.tagTemplate.create({
              data: {
                name: tagDto.name,
                color: tagDto.color ?? '#6366F1',
                icon: tagDto.icon,
                description: tagDto.description,
                fieldDefinitions: tagDto.fieldDefinitions ?? [],
                viewConfig: tagDto.viewConfig ?? undefined,
                isGlobalDefault: tagDto.isGlobalDefault ?? true,
                status: tagDto.status ?? 'active',
                order: tagDto.order ?? 0,
                templateContent: tagDto.templateContent,
                creatorId: tagDto.creatorId,
              },
            });
            result.created++;
          }
        } catch (error) {
          result.errors.push({
            name: tagDto.name,
            reason: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    });

    return result;
  }

  // =============== 工具方法 ===============

  private toCompatibleFormat(
    tag: {
      id: string;
      name: string;
      color: string;
      icon: string | null;
      description: string | null;
      fieldDefinitions: unknown;
      order: number;
      templateContent: unknown;
      viewConfig: unknown;
      createdAt: Date;
      updatedAt: Date;
      isGlobalDefault: boolean;
      status: string;
      creatorId: string | null;
      _count?: { nodes: number };
    },
  ) {
    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      icon: tag.icon,
      description: tag.description,
      fieldDefinitions: tag.fieldDefinitions,
      order: tag.order,
      templateContent: tag.templateContent,
      viewConfig: tag.viewConfig,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
      isGlobalDefault: tag.isGlobalDefault,
      status: tag.status,
      creatorId: tag.creatorId,
      // 兼容字段保留，但不再绑定预设语义
      isSystem: false,
      _count: tag._count,
    };
  }
}

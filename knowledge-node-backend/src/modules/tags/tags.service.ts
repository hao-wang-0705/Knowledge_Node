import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateSupertagDto,
  UpdateSupertagDto,
  BatchCreateSupertagsDto,
} from './dto/tag.dto';

/** 字段定义（JSON 内结构），含 key 用于合并；导出供 controller 返回类型使用 */
export interface FieldDefRecord {
  key?: string;
  id?: string;
  name?: string;
  type?: string;
  [k: string]: any;
}

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 检测若将 tagId 的 parent 设为 newParentId 是否会形成循环继承
   */
  private async ensureNoCycle(userId: string, tagId: string, newParentId: string): Promise<void> {
    let currentId: string | null = newParentId;
    const seen = new Set<string>([tagId]);
    while (currentId) {
      if (seen.has(currentId)) {
        throw new BadRequestException('Supertag inheritance cycle detected');
      }
      seen.add(currentId);
      const row: { parentId: string | null } | null = await this.prisma.supertag.findFirst({
        where: { id: currentId, userId },
        select: { parentId: true },
      });
      currentId = row?.parentId ?? null;
    }
  }

  /**
   * 合并继承链上的字段定义：从根到当前，同 key 时后者覆盖（子可覆盖父的显示等）
   */
  private mergeFieldDefinitions(ancestorDefs: FieldDefRecord[], selfDefs: FieldDefRecord[]): FieldDefRecord[] {
    const byKey = new Map<string, FieldDefRecord>();
    const keysOrder: string[] = [];
    const add = (d: FieldDefRecord, inherited: boolean) => {
      const key = d.key ?? d.id ?? `_${keysOrder.length}`;
      if (!byKey.has(key)) keysOrder.push(key);
      byKey.set(key, { ...d, inherited });
    };
    ancestorDefs.forEach((d) => add(d, true));
    selfDefs.forEach((d) => add(d, false));
    return keysOrder.map((k) => byKey.get(k)!);
  }

  /**
   * 解析单个标签并返回合并继承后的字段定义（含自身及所有祖先）
   */
  async resolveSupertagWithInheritance(userId: string, id: string) {
    const supertag = await this.prisma.supertag.findFirst({
      where: { id, userId },
      include: {
        parent: true,
        _count: { select: { nodes: true } },
      },
    });
    if (!supertag) {
      throw new NotFoundException(`Supertag with ID ${id} not found`);
    }
    const selfDefs = (supertag.fieldDefinitions as FieldDefRecord[]) ?? [];
    const ancestorDefs: FieldDefRecord[] = [];
    let current: typeof supertag.parent = supertag.parent;
    while (current) {
      const defs = (current.fieldDefinitions as FieldDefRecord[]) ?? [];
      ancestorDefs.push(...defs);
      const next = await this.prisma.supertag.findFirst({
        where: { id: current.id, userId },
        include: { parent: true },
      });
      current = next?.parent ?? null;
    }
    const resolvedFieldDefinitions = this.mergeFieldDefinitions(ancestorDefs, selfDefs);
    return {
      ...supertag,
      resolvedFieldDefinitions,
    };
  }

  // =============== Supertag Methods ===============

  async createSupertag(userId: string, createDto: CreateSupertagDto) {
    // 检查名称是否已存在
    const existing = await this.prisma.supertag.findUnique({
      where: {
        userId_name: { userId, name: createDto.name },
      },
    });

    if (existing) {
      throw new ConflictException(`Supertag with name "${createDto.name}" already exists`);
    }

    if (createDto.parentId) {
      const parent = await this.prisma.supertag.findFirst({
        where: { id: createDto.parentId, userId },
      });
      if (!parent) {
        throw new BadRequestException(`Parent supertag ${createDto.parentId} not found`);
      }
    }

    return this.prisma.supertag.create({
      data: {
        name: createDto.name,
        color: createDto.color,
        categoryId: createDto.categoryId,
        icon: createDto.icon,
        description: createDto.description,
        fieldDefinitions: createDto.fieldDefinitions || [],
        isSystem: createDto.isSystem ?? false,
        parentId: createDto.parentId ?? undefined,
        templateContent: createDto.templateContent ?? undefined,
        userId,
      },
    });
  }

  async batchCreateSupertags(userId: string, batchDto: BatchCreateSupertagsDto) {
    const results = await Promise.all(
      batchDto.supertags.map((supertag) =>
        this.createSupertag(userId, supertag).catch((err) => ({
          error: err.message,
          name: supertag.name,
        }))
      )
    );

    return results;
  }

  async findAllSupertags(userId: string) {
    return this.prisma.supertag.findMany({
      where: { userId },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: {
        _count: {
          select: { nodes: true },
        },
      },
    });
  }

  async findSupertagsByCategory(userId: string, categoryId: string) {
    return this.prisma.supertag.findMany({
      where: { userId, categoryId },
      orderBy: { name: 'asc' },
    });
  }

  async findOneSupertag(userId: string, id: string) {
    return this.resolveSupertagWithInheritance(userId, id);
  }

  async updateSupertag(userId: string, id: string, updateDto: UpdateSupertagDto) {
    const supertag = await this.resolveSupertagWithInheritance(userId, id);

    if (updateDto.name && updateDto.name !== supertag.name) {
      const existing = await this.prisma.supertag.findUnique({
        where: {
          userId_name: { userId, name: updateDto.name },
        },
      });
      if (existing) {
        throw new ConflictException(`Supertag with name "${updateDto.name}" already exists`);
      }
    }

    if (updateDto.parentId !== undefined) {
      if (updateDto.parentId === null || updateDto.parentId === '') {
        updateDto.parentId = undefined;
      } else {
        await this.ensureNoCycle(userId, id, updateDto.parentId);
        const parent = await this.prisma.supertag.findFirst({
          where: { id: updateDto.parentId, userId },
        });
        if (!parent) {
          throw new BadRequestException(`Parent supertag ${updateDto.parentId} not found`);
        }
      }
    }

    const { resolvedFieldDefinitions, ...rest } = supertag as any;
    const data: Record<string, any> = { ...updateDto };
    delete data.resolvedFieldDefinitions;
    return this.prisma.supertag.update({
      where: { id },
      data,
    });
  }

  async removeSupertag(userId: string, id: string) {
    await this.findOneSupertag(userId, id);

    // 将所有使用该标签的节点的 supertagId 设为 null
    await this.prisma.node.updateMany({
      where: { supertagId: id, userId },
      data: { supertagId: null },
    });

    return this.prisma.supertag.delete({
      where: { id },
    });
  }

  // 搜索标签
  async searchTags(userId: string, query: string) {
    const supertags = await this.prisma.supertag.findMany({
      where: {
        userId,
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      take: 10,
    });

    return { supertags };
  }
}

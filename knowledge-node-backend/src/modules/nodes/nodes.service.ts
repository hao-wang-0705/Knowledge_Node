import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateNodeDto,
  UpdateNodeDto,
  BatchCreateNodesDto,
  BatchUpdateNodesDto,
  MoveNodeDto,
} from './dto/node.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class NodesService {
  constructor(private prisma: PrismaService) {}

  // 创建单个节点
  async create(userId: string, createNodeDto: CreateNodeDto) {
    const id = createNodeDto.id || uuidv4();
    
    return this.prisma.node.create({
      data: {
        id,
        content: createNodeDto.content || '',
        nodeType: createNodeDto.nodeType || 'text',
        parentId: createNodeDto.parentId,
        sortOrder: createNodeDto.sortOrder || 0,
        isCollapsed: createNodeDto.isCollapsed || false,
        fields: createNodeDto.fields || {},
        payload: createNodeDto.payload || {},
        supertagId: createNodeDto.supertagId,
        userId,
      },
    });
  }

  // 批量创建节点
  async batchCreate(userId: string, batchCreateDto: BatchCreateNodesDto) {
    const nodes = batchCreateDto.nodes.map((node) => ({
      id: node.id || uuidv4(),
      content: node.content || '',
      nodeType: node.nodeType || 'text',
      parentId: node.parentId,
      sortOrder: node.sortOrder || 0,
      isCollapsed: node.isCollapsed || false,
      fields: node.fields || {},
      payload: node.payload || {},
      supertagId: node.supertagId,
      userId,
    }));

    return this.prisma.node.createMany({
      data: nodes,
    });
  }

  // 获取用户的所有节点
  async findAll(userId: string) {
    return this.prisma.node.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  // 获取根级别节点（没有父节点的节点）
  async findRootNodes(userId: string) {
    return this.prisma.node.findMany({
      where: {
        userId,
        parentId: null,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  // 获取单个节点
  async findOne(userId: string, id: string) {
    const node = await this.prisma.node.findFirst({
      where: { id, userId },
    });

    if (!node) {
      throw new NotFoundException(`Node with ID ${id} not found`);
    }

    return node;
  }

  // 获取节点的所有子节点
  async findChildren(userId: string, parentId: string) {
    return this.prisma.node.findMany({
      where: { userId, parentId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  // 获取节点及其所有子节点（树形结构）
  async findNodeWithChildren(userId: string, id: string): Promise<any> {
    const node = await this.findOne(userId, id);
    const children = await this.findChildren(userId, id);
    
    if (children.length === 0) {
      return { ...node, children: [] };
    }

    const childrenWithDescendants: any[] = await Promise.all(
      children.map((child) =>
        this.findNodeWithChildren(userId, child.id).catch(() => null)
      )
    );

    return {
      ...node,
      children: childrenWithDescendants.filter(Boolean),
    };
  }

  // 更新单个节点
  async update(userId: string, id: string, updateNodeDto: UpdateNodeDto) {
    await this.findOne(userId, id); // 确保节点存在且属于该用户

    return this.prisma.node.update({
      where: { id },
      data: updateNodeDto,
    });
  }

  // 批量更新节点
  async batchUpdate(userId: string, batchUpdateDto: BatchUpdateNodesDto) {
    const results = await Promise.all(
      batchUpdateDto.nodes.map(async (node) => {
        const { id, ...updateData } = node;
        return this.update(userId, id, updateData);
      })
    );

    return results;
  }

  // 移动节点（改变父节点和位置）
  async move(userId: string, id: string, moveDto: MoveNodeDto) {
    await this.findOne(userId, id); // 确保节点存在

    return this.prisma.node.update({
      where: { id },
      data: {
        parentId: moveDto.newParentId || null,
        sortOrder: moveDto.newSortOrder ?? 0,
      },
    });
  }

  // 缩进节点（成为上一个兄弟节点的子节点）
  async indent(userId: string, id: string) {
    const node = await this.findOne(userId, id);
    
    if (!node.parentId) {
      // 获取同级的前一个节点
      const siblings = await this.prisma.node.findMany({
        where: { userId, parentId: null, sortOrder: { lt: node.sortOrder } },
        orderBy: { sortOrder: 'desc' },
        take: 1,
      });

      if (siblings.length === 0) {
        throw new Error('No previous sibling to become parent');
      }

      return this.move(userId, id, { newParentId: siblings[0].id });
    }

    const siblings = await this.prisma.node.findMany({
      where: { userId, parentId: node.parentId, sortOrder: { lt: node.sortOrder } },
      orderBy: { sortOrder: 'desc' },
      take: 1,
    });

    if (siblings.length === 0) {
      throw new Error('No previous sibling to become parent');
    }

    return this.move(userId, id, { newParentId: siblings[0].id });
  }

  // 反缩进节点（成为父节点的下一个兄弟节点）
  async outdent(userId: string, id: string) {
    const node = await this.findOne(userId, id);

    if (!node.parentId) {
      throw new Error('Root nodes cannot be outdented');
    }

    const parent = await this.findOne(userId, node.parentId);
    const grandParentId = parent.parentId;

    return this.move(userId, id, {
      newParentId: grandParentId || undefined,
      newSortOrder: parent.sortOrder + 1,
    });
  }

  // 删除单个节点（包括其所有子节点）
  async remove(userId: string, id: string) {
    const node = await this.findOne(userId, id);

    // 递归删除所有子节点
    const children = await this.findChildren(userId, id);
    if (children.length > 0) {
      await Promise.all(
        children.map((child) =>
          this.remove(userId, child.id).catch(() => {})
        )
      );
    }

    return this.prisma.node.delete({
      where: { id },
    });
  }

  // 批量删除节点
  async batchRemove(userId: string, ids: string[]) {
    const results = await Promise.all(
      ids.map((id) => this.remove(userId, id).catch(() => null))
    );

    return results.filter(Boolean);
  }

  // 按标签查找节点
  async findBySupertag(userId: string, supertagId: string) {
    return this.prisma.node.findMany({
      where: { userId, supertagId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 搜索节点内容
  async search(userId: string, query: string) {
    return this.prisma.node.findMany({
      where: {
        userId,
        content: {
          contains: query,
          mode: 'insensitive',
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
  }

  // 切换节点折叠状态
  async toggleCollapse(userId: string, id: string) {
    const node = await this.findOne(userId, id);

    return this.prisma.node.update({
      where: { id },
      data: { isCollapsed: !node.isCollapsed },
    });
  }
}

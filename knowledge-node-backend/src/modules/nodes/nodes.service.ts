import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateNodeDto,
  UpdateNodeDto,
  BatchCreateNodesDto,
  BatchUpdateNodesDto,
  MoveNodeDto,
} from './dto/node.dto';
import { v4 as uuidv4 } from 'uuid';

type NodeApiModel = {
  id: string;
  content: string;
  type: string;
  parentId: string | null;
  sortOrder: number;
  childrenIds: string[];
  isCollapsed: boolean;
  tags: string[];
  supertagId: string | null;
  scope?: string;
  notebookId?: string | null;
  fields: Record<string, unknown>;
  payload: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

@Injectable()
export class NodesService {
  constructor(private prisma: PrismaService) {}

  private async resolveScopeAndNotebookId(
    userId: string,
    parentId: string | null,
    dto: CreateNodeDto,
  ): Promise<{ scope: string; notebookId: string | null }> {
    if (dto.scope != null) {
      return {
        scope: dto.scope,
        notebookId: dto.scope === 'notebook' ? (dto.notebookId ?? null) : null,
      };
    }
    if (parentId) {
      const parent = await this.prisma.node.findFirst({
        where: { id: parentId, userId },
        select: { scope: true, notebookId: true },
      });
      if (parent) {
        return {
          scope: parent.scope ?? 'general',
          notebookId: parent.notebookId ?? null,
        };
      }
    }
    return { scope: 'general', notebookId: null };
  }

  private async mapNodeToApiModel(
    node: {
      id: string;
      content: string;
      nodeType: string;
      parentId: string | null;
      sortOrder: number;
      isCollapsed: boolean;
      supertagId: string | null;
      scope?: string | null;
      notebookId?: string | null;
      fields: unknown;
      payload: unknown;
      createdAt: Date;
      updatedAt: Date;
    },
    userId: string,
  ): Promise<NodeApiModel> {
    const children = await this.prisma.node.findMany({
      where: { userId, parentId: node.id },
      select: { id: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return {
      id: node.id,
      content: node.content,
      type: node.nodeType,
      parentId: node.parentId,
      sortOrder: node.sortOrder,
      childrenIds: children.map((c) => c.id),
      isCollapsed: node.isCollapsed,
      tags: [],
      supertagId: node.supertagId,
      scope: node.scope ?? undefined,
      notebookId: node.notebookId ?? undefined,
      fields: (node.fields as Record<string, unknown>) ?? {},
      payload: (node.payload as Record<string, unknown>) ?? {},
      createdAt: node.createdAt.getTime(),
      updatedAt: node.updatedAt.getTime(),
    };
  }

  // 创建单个节点
  async create(userId: string, createNodeDto: CreateNodeDto) {
    const id = createNodeDto.id || uuidv4();
    const parentId = createNodeDto.parentId ?? null;
    const { scope, notebookId } = await this.resolveScopeAndNotebookId(userId, parentId, createNodeDto);

    const node = await this.prisma.node.create({
      data: {
        id,
        content: createNodeDto.content || '',
        nodeType: createNodeDto.nodeType || 'text',
        parentId,
        sortOrder: createNodeDto.sortOrder || 0,
        isCollapsed: createNodeDto.isCollapsed || false,
        fields: createNodeDto.fields || {},
        payload: createNodeDto.payload || {},
        supertagId: createNodeDto.supertagId,
        scope,
        notebookId,
        userId,
      },
    });
    return this.mapNodeToApiModel(node, userId);
  }

  // 批量创建节点
  async batchCreate(userId: string, batchCreateDto: BatchCreateNodesDto) {
    const nodesWithScope: Array<{
      id: string;
      content: string;
      nodeType: string;
      parentId: string | null;
      sortOrder: number;
      isCollapsed: boolean;
      fields: Record<string, unknown>;
      payload: Record<string, unknown>;
      supertagId: string | null;
      scope: string;
      notebookId: string | null;
      userId: string;
    }> = [];
    for (const node of batchCreateDto.nodes) {
      const parentId = node.parentId ?? null;
      const { scope, notebookId } = await this.resolveScopeAndNotebookId(userId, parentId, node);
      nodesWithScope.push({
        id: node.id || uuidv4(),
        content: node.content || '',
        nodeType: node.nodeType || 'text',
        parentId,
        sortOrder: node.sortOrder || 0,
        isCollapsed: node.isCollapsed || false,
        fields: node.fields || {},
        payload: node.payload || {},
        supertagId: node.supertagId ?? null,
        scope,
        notebookId,
        userId,
      });
    }

    await this.prisma.node.createMany({
      data: nodesWithScope as Prisma.NodeCreateManyInput[],
    });
    const created = await this.prisma.node.findMany({
      where: { userId, id: { in: nodesWithScope.map((n) => n.id) } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return Promise.all(created.map((node) => this.mapNodeToApiModel(node, userId)));
  }

  // 获取用户的所有节点（ADR-005：支持 scope/notebookId 树隔离）
  async findAll(
    userId: string,
    options?: { scope?: string; notebookId?: string },
  ) {
    const where = await this.buildScopeWhere(userId, options);
    const nodes = await this.prisma.node.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return Promise.all(nodes.map((node) => this.mapNodeToApiModel(node, userId)));
  }

  private async buildScopeWhere(
    userId: string,
    options?: { scope?: string; notebookId?: string },
  ): Promise<Record<string, unknown>> {
    const scope = options?.scope;
    const notebookId = options?.notebookId;
    if (scope === 'notebook' && notebookId) {
      return { userId, scope: 'notebook', notebookId };
    }
    const where: Record<string, unknown> = {
      userId,
      AND: [{ OR: [{ scope: 'general' }, { scope: 'daily' }] }],
    };
    const rows = await this.prisma.notebook.findMany({
      where: { userId },
      select: { rootNodeId: true },
    });
    const ids = rows.map((r) => r.rootNodeId).filter((id): id is string => id != null);
    if (ids.length > 0) (where.AND as any[]).push({ id: { notIn: ids } });
    return where;
  }

  // 获取根级别节点（没有父节点的节点）
  async findRootNodes(
    userId: string,
    options?: { scope?: string; notebookId?: string },
  ) {
    const baseWhere = await (async () => {
      const scope = options?.scope;
      const notebookId = options?.notebookId;
      if (scope === 'notebook' && notebookId) {
        return { userId, parentId: null, scope: 'notebook', notebookId };
      }
      const notebookRootIds = await this.prisma.notebook
        .findMany({ where: { userId }, select: { rootNodeId: true } })
        .then((rows) => rows.map((r) => r.rootNodeId).filter((id): id is string => id != null));
      return {
        userId,
        parentId: null,
        AND: [
          { OR: [{ scope: 'general' }, { scope: 'daily' }] },
          ...(notebookRootIds.length > 0 ? [{ id: { notIn: notebookRootIds } }] : []),
        ],
      };
    })();
    const nodes = await this.prisma.node.findMany({
      where: baseWhere,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return Promise.all(nodes.map((node) => this.mapNodeToApiModel(node, userId)));
  }

  // 获取单个节点
  async findOne(userId: string, id: string) {
    const node = await this.prisma.node.findFirst({
      where: { id, userId },
    });

    if (!node) {
      throw new NotFoundException(`Node with ID ${id} not found`);
    }

    return this.mapNodeToApiModel(node, userId);
  }

  // 获取节点的所有子节点
  async findChildren(userId: string, parentId: string) {
    const nodes = await this.prisma.node.findMany({
      where: { userId, parentId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return Promise.all(nodes.map((node) => this.mapNodeToApiModel(node, userId)));
  }

  // 获取节点及其所有子节点（树形结构）
  async findNodeWithChildren(userId: string, id: string): Promise<any> {
    const rawNode = await this.prisma.node.findFirst({ where: { id, userId } });
    if (!rawNode) throw new NotFoundException(`Node with ID ${id} not found`);
    const node = await this.mapNodeToApiModel(rawNode, userId);
    const children = await this.prisma.node.findMany({
      where: { userId, parentId: id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    
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

    const node = await this.prisma.node.update({
      where: { id },
      data: updateNodeDto,
    });
    return this.mapNodeToApiModel(node, userId);
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

    const node = await this.prisma.node.update({
      where: { id },
      data: {
        parentId: moveDto.newParentId || null,
        sortOrder: moveDto.newSortOrder ?? 0,
      },
    });
    return this.mapNodeToApiModel(node, userId);
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

  // 删除单个节点（包括其所有子节点）；ADR-005：禁止直接删笔记本根节点
  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    const notebook = await this.prisma.notebook.findFirst({
      where: { userId, rootNodeId: id },
      select: { id: true },
    });
    if (notebook) {
      throw new ConflictException('不能直接删除笔记本根节点，请通过删除笔记本操作');
    }

    // 递归删除所有子节点
    const children = await this.findChildren(userId, id);
    if (children.length > 0) {
      await Promise.all(
        children.map((child) =>
          this.remove(userId, child.id).catch(() => {})
        )
      );
    }

    await this.prisma.node.delete({
      where: { id },
    });
    return { success: true };
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
    const nodes = await this.prisma.node.findMany({
      where: { userId, supertagId },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(nodes.map((node) => this.mapNodeToApiModel(node, userId)));
  }

  // 搜索节点内容
  async search(userId: string, query: string) {
    const nodes = await this.prisma.node.findMany({
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
    return Promise.all(nodes.map((node) => this.mapNodeToApiModel(node, userId)));
  }

  // 切换节点折叠状态
  async toggleCollapse(userId: string, id: string) {
    const node = await this.prisma.node.findFirst({ where: { id, userId } });
    if (!node) throw new NotFoundException(`Node with ID ${id} not found`);

    const updated = await this.prisma.node.update({
      where: { id },
      data: { isCollapsed: !node.isCollapsed },
    });
    return this.mapNodeToApiModel(updated, userId);
  }
}

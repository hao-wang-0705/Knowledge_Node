import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
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
  nodeRole?: string;
  parentId: string | null;
  sortOrder: number;
  childrenIds: string[];
  isCollapsed: boolean;
  tags: string[];
  references: unknown[];
  supertagId: string | null;
  fields: Record<string, unknown>;
  payload: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

type NodeRole = string;

@Injectable()
export class NodesService {
  constructor(private prisma: PrismaService) {}

  private async ensureStructuralRoots(userId: string) {
    let userRoot = await this.prisma.node.findFirst({
      where: { userId, nodeRole: 'user_root' },
      select: { id: true },
    });
    if (!userRoot) {
      userRoot = await this.prisma.node.create({
        data: {
          id: `user-root-${userId}`,
          userId,
          content: '用户根节点',
          nodeType: 'root',
          nodeRole: 'user_root',
        },
        select: { id: true },
      });
    }

    const dailyRoot = await this.prisma.node.findFirst({
      where: { userId, nodeRole: 'daily_root' },
      select: { id: true },
    });
    if (!dailyRoot) {
      await this.prisma.node.create({
        data: {
          id: `daily-root-${userId}`,
          userId,
          parentId: userRoot.id,
          content: '每日笔记(Daily Note)',
          nodeType: 'daily',
          nodeRole: 'daily_root',
        },
      });
    }
  }

  private async getRawNodeOrThrow(userId: string, id: string) {
    const node = await this.prisma.node.findFirst({
      where: { id, userId },
      select: {
        id: true,
        userId: true,
        parentId: true,
        nodeRole: true,
        sortOrder: true,
      },
    });
    if (!node) throw new NotFoundException(`Node with ID ${id} not found`);
    return node as {
      id: string;
      userId: string;
      parentId: string | null;
      nodeRole: NodeRole;
      sortOrder: number;
    };
  }

  private async assertNoCycle(userId: string, nodeId: string, newParentId: string | null) {
    if (!newParentId) return;
    if (nodeId === newParentId) {
      throw new BadRequestException('节点不能将自己作为父节点');
    }

    let cursor: string | null = newParentId;
    while (cursor) {
      if (cursor === nodeId) {
        throw new BadRequestException('检测到循环引用，禁止形成环');
      }
      const parent: { parentId: string | null } | null = await this.prisma.node.findFirst({
        where: { id: cursor, userId },
        select: { parentId: true },
      });
      cursor = parent?.parentId ?? null;
    }
  }

  private async mapNodeToApiModel(
    node: {
      id: string;
      content: string;
      nodeType: string;
      nodeRole?: string | null;
      parentId: string | null;
      sortOrder: number;
      isCollapsed: boolean;
      supertagId: string | null;
      tags: string[];
      references: unknown;
      fields: unknown;
      payload: unknown;
      createdAt: Date;
      updatedAt: Date;
      [key: string]: unknown;
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
      nodeRole: node.nodeRole ?? undefined,
      parentId: node.parentId,
      sortOrder: node.sortOrder,
      childrenIds: children.map((c) => c.id),
      isCollapsed: node.isCollapsed,
      tags: node.tags ?? [],
      references: (Array.isArray(node.references) ? node.references : []) as unknown[],
      supertagId: node.supertagId,
      fields: (node.fields as Record<string, unknown>) ?? {},
      payload: (node.payload as Record<string, unknown>) ?? {},
      createdAt: node.createdAt.getTime(),
      updatedAt: node.updatedAt.getTime(),
    };
  }

  // 创建单个节点（upsert 语义：已存在则更新，避免 P2002 唯一约束冲突）
  async create(userId: string, createNodeDto: CreateNodeDto) {
    const id = createNodeDto.id || uuidv4();
    let resolvedParentId = createNodeDto.parentId ?? null;

    if (resolvedParentId) {
      let parentExists = await this.prisma.node.findFirst({
        where: { id: resolvedParentId, userId },
        select: { id: true },
      });
      
      // 增强重试策略：扩展窗口到 3000ms（5次 x 600ms间隔）
      // 支持更大的同步批次和网络延迟场景
      if (!parentExists) {
        const maxRetries = 5;
        const retryInterval = 600;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          console.log(
            `[NodesService] create: 等待父节点 ${resolvedParentId}，第 ${attempt + 1}/${maxRetries} 次重试...`,
          );
          await new Promise((r) => setTimeout(r, retryInterval));
          parentExists = await this.prisma.node.findFirst({
            where: { id: resolvedParentId, userId },
            select: { id: true },
          });
          if (parentExists) {
            console.log(
              `[NodesService] create: 父节点 ${resolvedParentId} 已就绪，重试 ${attempt + 1} 次后成功`,
            );
            break;
          }
        }
      }
      
      // 严格校验：若父节点仍不存在，抛出错误而非降级为 null（避免产生孤儿节点）
      if (!parentExists) {
        console.error(
          `[NodesService] create: parentId=${resolvedParentId} not found after ${5} retries for node ${id}`,
        );
        throw new BadRequestException(
          `父节点 ${resolvedParentId} 不存在，无法创建节点 ${id}。请确保父节点已同步到服务器。`,
        );
      }
    }

    const fieldsJson = (createNodeDto.fields as Record<string, unknown>) ?? {};
    const payloadJson = (createNodeDto.payload as Record<string, unknown>) ?? {};
    const tagsArr = createNodeDto.tags ?? [];
    const refsJson = createNodeDto.references ?? null;
    const refsValue = refsJson !== null
      ? (refsJson as Prisma.InputJsonValue)
      : Prisma.JsonNull;

    const createData: Prisma.NodeUncheckedCreateInput = {
      id,
      content: createNodeDto.content || '',
      nodeType: createNodeDto.nodeType || 'text',
      parentId: resolvedParentId,
      sortOrder: createNodeDto.sortOrder ?? 0,
      isCollapsed: createNodeDto.isCollapsed ?? false,
      fields: fieldsJson as Prisma.InputJsonValue,
      payload: payloadJson as Prisma.InputJsonValue,
      supertagId: createNodeDto.supertagId ?? null,
      tags: tagsArr,
      references: refsValue,
      nodeRole: 'normal',
      userId,
    };

    const node = await this.prisma.node.upsert({
      where: { id },
      create: createData,
      update: {
        content: createData.content,
        parentId: createData.parentId,
        sortOrder: createData.sortOrder,
        isCollapsed: createData.isCollapsed,
        fields: fieldsJson as Prisma.InputJsonValue,
        payload: payloadJson as Prisma.InputJsonValue,
        supertagId: createData.supertagId,
        tags: tagsArr,
        references: refsValue,
      },
    });
    return this.mapNodeToApiModel(node, userId);
  }

  // 批量创建节点
  async batchCreate(userId: string, batchCreateDto: BatchCreateNodesDto) {
    const nodesData: Array<{
      id: string;
      content: string;
      nodeType: string;
      nodeRole: string;
      parentId: string | null;
      sortOrder: number;
      isCollapsed: boolean;
      fields: Record<string, unknown>;
      payload: Record<string, unknown>;
      tags: string[];
      references: any;
      supertagId: string | null;
      userId: string;
    }> = [];
    for (const node of batchCreateDto.nodes) {
      const parentId = node.parentId ?? null;
      if (parentId) await this.getRawNodeOrThrow(userId, parentId);
      nodesData.push({
        id: node.id || uuidv4(),
        content: node.content || '',
        nodeType: node.nodeType || 'text',
        nodeRole: 'normal',
        parentId,
        sortOrder: node.sortOrder || 0,
        isCollapsed: node.isCollapsed || false,
        fields: node.fields || {},
        payload: node.payload || {},
        tags: node.tags || [],
        references: node.references ?? null,
        supertagId: node.supertagId ?? null,
        userId,
      });
    }

    await this.prisma.node.createMany({
      data: nodesData as Prisma.NodeCreateManyInput[],
    });
    const created = await this.prisma.node.findMany({
      where: { userId, id: { in: nodesData.map((n) => n.id) } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return Promise.all(created.map((node) => this.mapNodeToApiModel(node, userId)));
  }

  // 获取用户的所有节点（统一树：可选 rootNodeId 子树）
  async findAll(userId: string, options?: { rootNodeId?: string }) {
    await this.ensureStructuralRoots(userId);
    if (options?.rootNodeId) {
      const nodes = await this.getSubtreeNodes(userId, options.rootNodeId);
      return Promise.all(nodes.map((node) => this.mapNodeToApiModel(node, userId)));
    }
    const nodes = await this.prisma.node.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return Promise.all(nodes.map((node) => this.mapNodeToApiModel(node, userId)));
  }

  private async getSubtreeNodes(userId: string, rootNodeId: string) {
    const root = await this.prisma.node.findFirst({
      where: { id: rootNodeId, userId },
    });
    if (!root) throw new NotFoundException(`Node with ID ${rootNodeId} not found`);

    const ids: string[] = [rootNodeId];
    const queue: string[] = [rootNodeId];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = await this.prisma.node.findMany({
        where: { userId, parentId: currentId },
        select: { id: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
      if (children.length > 0) {
        const childIds = children.map((c) => c.id);
        ids.push(...childIds);
        queue.push(...childIds);
      }
    }

    return this.prisma.node.findMany({
      where: { userId, id: { in: ids } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  // 获取根级别节点（parentId 为 null）
  async findRootNodes(userId: string) {
    await this.ensureStructuralRoots(userId);
    const nodes = await this.prisma.node.findMany({
      where: { userId, parentId: null },
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
    const existing = await this.getRawNodeOrThrow(userId, id);
    let nextParentId =
      updateNodeDto.parentId !== undefined ? (updateNodeDto.parentId ?? null) : existing.parentId;

    if (updateNodeDto.parentId !== undefined) {
      await this.assertNoCycle(userId, id, nextParentId);
      if (nextParentId) {
        const parentExists = await this.prisma.node.findFirst({
          where: { id: nextParentId, userId },
          select: { id: true },
        });
        if (!parentExists) {
          console.warn(
            `[NodesService] update: parentId=${nextParentId} not found, keeping existing parentId for node ${id}`,
          );
          nextParentId = existing.parentId;
        }
      }
    }

    const node = await this.prisma.node.update({
      where: { id },
      data: {
        ...updateNodeDto,
        parentId: nextParentId,
      },
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
    const existing = await this.getRawNodeOrThrow(userId, id);
    if (existing.nodeRole !== 'normal') {
      throw new ConflictException('结构根节点不能通过通用移动接口调整');
    }
    const nextParentId =
      moveDto.newParentId !== undefined ? (moveDto.newParentId ?? null) : existing.parentId;
    await this.assertNoCycle(userId, id, nextParentId);
    if (nextParentId) await this.getRawNodeOrThrow(userId, nextParentId);

    const node = await this.prisma.node.update({
      where: { id },
      data: {
        parentId: nextParentId,
        sortOrder: moveDto.newSortOrder ?? existing.sortOrder,
      },
    });
    return this.mapNodeToApiModel(node, userId);
  }

  // 缩进节点（成为上一个兄弟节点的子节点）
  async indent(userId: string, id: string) {
    const node = await this.findOne(userId, id);
    const rawNode = await this.getRawNodeOrThrow(userId, id);
    if (rawNode.nodeRole !== 'normal') {
      throw new ConflictException('结构根节点不能缩进');
    }
    
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
    const rawNode = await this.getRawNodeOrThrow(userId, id);
    if (rawNode.nodeRole !== 'normal') {
      throw new ConflictException('结构根节点不能反缩进');
    }

    if (!node.parentId) {
      throw new Error('Root nodes cannot be outdented');
    }

    const parent = await this.findOne(userId, node.parentId);
    const grandParentId = parent.parentId;

    return this.move(userId, id, {
      newParentId: grandParentId ?? undefined,
      newSortOrder: parent.sortOrder + 1,
    });
  }

  // 删除单个节点（包括其所有子节点）；禁止删除 user_root / daily_root
  async remove(userId: string, id: string) {
    const node = await this.getRawNodeOrThrow(userId, id);
    if (node.nodeRole !== 'normal') {
      throw new ConflictException('结构根节点不能通过通用删除接口删除');
    }

    // 递归删除所有子节点
    const children = await this.findChildren(userId, id);
    if (children.length > 0) {
      await Promise.all(children.map((child) => this.remove(userId, child.id)));
    }

    await this.prisma.node.delete({
      where: { id },
    });
    return { success: true };
  }

  // 批量删除节点
  async batchRemove(userId: string, ids: string[]) {
    const results = await Promise.all(ids.map((id) => this.remove(userId, id)));
    return results;
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

  /**
   * 清理孤儿节点：删除所有 parentId=null 且 nodeRole='normal' 的节点及其子树
   * 孤儿节点定义：parentId 为 null 但不是结构根节点（user_root/daily_root）
   */
  async cleanupOrphanNodes(userId: string): Promise<{
    deletedCount: number;
    deletedIds: string[];
  }> {
    // 查找所有孤儿节点：parentId 为 null 且 nodeRole 为 'normal'
    const orphanNodes = await this.prisma.node.findMany({
      where: {
        userId,
        parentId: null,
        nodeRole: 'normal',
      },
      select: { id: true, content: true },
    });

    if (orphanNodes.length === 0) {
      console.log(`[NodesService] cleanupOrphanNodes: 用户 ${userId} 无孤儿节点需要清理`);
      return { deletedCount: 0, deletedIds: [] };
    }

    console.log(
      `[NodesService] cleanupOrphanNodes: 找到 ${orphanNodes.length} 个孤儿节点待清理`,
      orphanNodes.map((n) => ({ id: n.id, content: n.content?.substring(0, 30) })),
    );

    const deletedIds: string[] = [];

    // 递归收集要删除的节点 ID（包括子节点）
    const collectNodeIdsToDelete = async (nodeId: string): Promise<string[]> => {
      const ids: string[] = [nodeId];
      const children = await this.prisma.node.findMany({
        where: { userId, parentId: nodeId },
        select: { id: true },
      });
      for (const child of children) {
        const childIds = await collectNodeIdsToDelete(child.id);
        ids.push(...childIds);
      }
      return ids;
    };

    // 收集所有要删除的节点 ID
    for (const orphan of orphanNodes) {
      const idsToDelete = await collectNodeIdsToDelete(orphan.id);
      deletedIds.push(...idsToDelete);
    }

    // 批量删除（从子节点开始删除，避免外键约束问题，使用反向顺序）
    const uniqueIds = [...new Set(deletedIds)];
    
    // 按层级深度排序（先删除深层子节点）
    const nodeDepths = new Map<string, number>();
    const calculateDepth = async (nodeId: string, visited = new Set<string>()): Promise<number> => {
      if (visited.has(nodeId)) return 0;
      visited.add(nodeId);
      
      if (nodeDepths.has(nodeId)) return nodeDepths.get(nodeId)!;
      
      const node = await this.prisma.node.findFirst({
        where: { id: nodeId, userId },
        select: { parentId: true },
      });
      
      if (!node || !node.parentId) {
        nodeDepths.set(nodeId, 0);
        return 0;
      }
      
      const parentDepth = await calculateDepth(node.parentId, visited);
      const depth = parentDepth + 1;
      nodeDepths.set(nodeId, depth);
      return depth;
    };

    for (const nodeId of uniqueIds) {
      await calculateDepth(nodeId);
    }

    // 按深度降序排序（深层先删）
    const sortedIds = uniqueIds.sort((a, b) => {
      const depthA = nodeDepths.get(a) ?? 0;
      const depthB = nodeDepths.get(b) ?? 0;
      return depthB - depthA;
    });

    // 逐个删除（确保顺序正确）
    for (const nodeId of sortedIds) {
      try {
        await this.prisma.node.delete({ where: { id: nodeId } });
      } catch (error) {
        console.warn(`[NodesService] cleanupOrphanNodes: 删除节点 ${nodeId} 失败:`, error);
      }
    }

    console.log(
      `[NodesService] cleanupOrphanNodes: 成功清理 ${sortedIds.length} 个节点`,
    );

    return {
      deletedCount: sortedIds.length,
      deletedIds: sortedIds,
    };
  }
}

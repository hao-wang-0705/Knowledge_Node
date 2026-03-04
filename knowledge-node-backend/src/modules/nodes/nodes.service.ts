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
import { format, getDate, getDay, getISOWeek, getISOWeekYear, getMonth, getYear, startOfDay } from 'date-fns';

type NodeApiModel = {
  id: string;
  serverId?: string;
  content: string;
  type: string;
  nodeRole?: string;
  parentId: string | null;
  appliedParentId?: string | null;
  appliedSortOrder?: number;
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
type CalendarNodeType = 'year' | 'week' | 'day';
type DiagnosticIssueCode = 'MISSING_ANCHOR' | 'WRONG_PARENT' | 'ORDER_CONFLICT' | 'CROSS_USER_PARENT';

type CalendarDiagnosticIssue = {
  issueCode: DiagnosticIssueCode;
  nodeId: string;
  nodeType: CalendarNodeType;
  currentParentId: string | null;
  expectedParentId: string | null;
  expectedParentType: string;
};

@Injectable()
export class NodesService {
  constructor(private prisma: PrismaService) {}

  private async findNodeByExternalId(userId: string, externalId: string) {
    return this.prisma.node.findFirst({
      where: {
        userId,
        logicalId: externalId,
      },
      select: {
        id: true,
        logicalId: true,
        userId: true,
        parentId: true,
        nodeRole: true,
        sortOrder: true,
      },
    });
  }

  private readonly weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  private getCalendarPath(date: Date) {
    const isoWeekYear = getISOWeekYear(date);
    const weekNumber = getISOWeek(date);
    const weekPadded = String(weekNumber).padStart(2, '0');
    const yearId = `year-${isoWeekYear}`;
    const weekId = `week-${isoWeekYear}-${weekPadded}`;
    const dayId = `day-${format(date, 'yyyy-MM-dd')}`;
    return {
      yearId,
      weekId,
      dayId,
      yearContent: `${isoWeekYear}年`,
      weekContent: `${isoWeekYear}年第${weekNumber}周`,
      dayContent: `${format(date, 'MM')}月${format(date, 'dd')}日 ${this.weekdayNames[getDay(date)]}`,
    };
  }

  private async ensureStructuralRoots(userId: string) {
    const [userRootCount, dailyRootCount] = await Promise.all([
      this.prisma.node.count({ where: { userId, nodeRole: 'user_root' } }),
      this.prisma.node.count({ where: { userId, nodeRole: 'daily_root' } }),
    ]);
    if (userRootCount > 1) {
      throw new ConflictException(`检测到重复 user_root（${userRootCount} 个），请先清理结构根后重试`);
    }
    if (dailyRootCount > 1) {
      throw new ConflictException(`检测到重复 daily_root（${dailyRootCount} 个），请先清理结构根后重试`);
    }

    let userRoot = await this.prisma.node.findFirst({
      where: { userId, nodeRole: 'user_root' },
      select: { id: true },
    });
    if (!userRoot) {
      userRoot = await this.prisma.node.create({
        data: {
          id: uuidv4(),
          logicalId: `user-root-${userId}`,
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
      select: { id: true, parentId: true },
    });
    if (!dailyRoot) {
      await this.prisma.node.create({
        data: {
          id: uuidv4(),
          logicalId: `daily-root-${userId}`,
          userId,
          parentId: userRoot.id,
          content: '每日笔记(Daily Note)',
          nodeType: 'daily',
          nodeRole: 'daily_root',
        },
      });
    } else if (dailyRoot.parentId !== userRoot.id) {
      await this.prisma.node.update({
        where: { id: dailyRoot.id },
        data: { parentId: userRoot.id, sortOrder: 0 },
      });
    }
  }

  private async getRawNodeOrThrow(userId: string, id: string) {
    const node = await this.findNodeByExternalId(userId, id);
    if (!node) throw new NotFoundException(`Node with ID ${id} not found`);
    return node as {
      id: string;
      logicalId: string;
      userId: string;
      parentId: string | null;
      nodeRole: NodeRole;
      sortOrder: number;
    };
  }

  private async assertNoCycle(userId: string, nodeId: string, newParentId: string | null) {
    if (!newParentId) return;
    const current = await this.getRawNodeOrThrow(userId, nodeId);
    const parent = await this.getRawNodeOrThrow(userId, newParentId);
    if (current.id === parent.id) {
      throw new BadRequestException('节点不能将自己作为父节点');
    }

    let cursor: string | null = parent.id;
    while (cursor) {
      if (cursor === current.id) {
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
      logicalId: string;
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
    const parent = node.parentId
      ? await this.prisma.node.findFirst({
          where: { userId, id: node.parentId },
          select: { logicalId: true },
        })
      : null;
    const children = await this.prisma.node.findMany({
      where: { userId, parentId: node.id },
      select: { logicalId: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return {
      id: node.logicalId,
      serverId: node.id,
      content: node.content,
      type: node.nodeType,
      nodeRole: node.nodeRole ?? undefined,
      parentId: parent?.logicalId ?? null,
      appliedParentId: parent?.logicalId ?? null,
      appliedSortOrder: node.sortOrder,
      sortOrder: node.sortOrder,
      childrenIds: children.map((c) => c.logicalId),
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

  private async mapNodesBatchToApiModel(
    userId: string,
    nodes: Array<{
      id: string;
      logicalId: string;
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
    }>,
  ): Promise<NodeApiModel[]> {
    if (nodes.length === 0) return [];
    const nodePhysicalIds = nodes.map((n) => n.id);
    const parentPhysicalIds = [...new Set(nodes.map((n) => n.parentId).filter((v): v is string => !!v))];
    const parentRows = parentPhysicalIds.length
      ? await this.prisma.node.findMany({
          where: { userId, id: { in: parentPhysicalIds } },
          select: { id: true, logicalId: true },
        })
      : [];
    const parentMap = new Map(parentRows.map((p) => [p.id, p.logicalId]));

    const childrenRows = await this.prisma.node.findMany({
      where: { userId, parentId: { in: nodePhysicalIds } },
      select: { parentId: true, logicalId: true, sortOrder: true, createdAt: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const childrenMap = new Map<string, string[]>();
    childrenRows.forEach((child) => {
      if (!child.parentId) return;
      const list = childrenMap.get(child.parentId) ?? [];
      list.push(child.logicalId);
      childrenMap.set(child.parentId, list);
    });

    return nodes.map((node) => ({
      id: node.logicalId,
      serverId: node.id,
      content: node.content,
      type: node.nodeType,
      nodeRole: node.nodeRole ?? undefined,
      parentId: node.parentId ? parentMap.get(node.parentId) ?? null : null,
      appliedParentId: node.parentId ? parentMap.get(node.parentId) ?? null : null,
      appliedSortOrder: node.sortOrder,
      sortOrder: node.sortOrder,
      childrenIds: childrenMap.get(node.id) ?? [],
      isCollapsed: node.isCollapsed,
      tags: node.tags ?? [],
      references: (Array.isArray(node.references) ? node.references : []) as unknown[],
      supertagId: node.supertagId,
      fields: (node.fields as Record<string, unknown>) ?? {},
      payload: (node.payload as Record<string, unknown>) ?? {},
      createdAt: node.createdAt.getTime(),
      updatedAt: node.updatedAt.getTime(),
    }));
  }

  // 创建单个节点（upsert 语义：已存在则更新，避免 P2002 唯一约束冲突）
  async create(userId: string, createNodeDto: CreateNodeDto) {
    const logicalId = createNodeDto.id || uuidv4();
    const id = uuidv4();
    let resolvedParentId: string | null = null;

    if (createNodeDto.parentId) {
      let parentExists = await this.findNodeByExternalId(userId, createNodeDto.parentId);
      
      // 增强重试策略：扩展窗口到 3000ms（5次 x 600ms间隔）
      // 支持更大的同步批次和网络延迟场景
      if (!parentExists) {
        const maxRetries = 5;
        const retryInterval = 600;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          console.log(
            `[NodesService] create: 等待父节点 ${createNodeDto.parentId}，第 ${attempt + 1}/${maxRetries} 次重试...`,
          );
          await new Promise((r) => setTimeout(r, retryInterval));
          parentExists = await this.findNodeByExternalId(userId, createNodeDto.parentId);
          if (parentExists) {
            console.log(
              `[NodesService] create: 父节点 ${createNodeDto.parentId} 已就绪，重试 ${attempt + 1} 次后成功`,
            );
            break;
          }
        }
      }
      
      // 严格校验：若父节点仍不存在，抛出错误而非降级为 null（避免产生孤儿节点）
      if (!parentExists) {
        console.error(
          `[NodesService] create: parentId=${createNodeDto.parentId} not found after ${5} retries for node ${logicalId}`,
        );
        throw new BadRequestException(
          `父节点 ${createNodeDto.parentId} 不存在，无法创建节点 ${logicalId}。请确保父节点已同步到服务器。`,
        );
      }
      resolvedParentId = parentExists.id;
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
      logicalId,
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
      where: {
        userId_logicalId: {
          userId,
          logicalId,
        },
      },
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
      logicalId: string;
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
      let parentId: string | null = null;
      if (node.parentId) {
        const parent = await this.getRawNodeOrThrow(userId, node.parentId);
        parentId = parent.id;
      }
      const logicalId = node.id || uuidv4();
      nodesData.push({
        id: uuidv4(),
        logicalId,
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
      where: { userId, logicalId: { in: nodesData.map((n) => n.logicalId) } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return Promise.all(created.map((node) => this.mapNodeToApiModel(node, userId)));
  }

  // 获取用户的所有节点（统一树：可选 rootNodeId 子树）
  async findAll(userId: string, options?: { rootNodeId?: string }) {
    await this.ensureStructuralRoots(userId);
    if (options?.rootNodeId) {
      const nodes = await this.getSubtreeNodes(userId, options.rootNodeId);
      return this.mapNodesBatchToApiModel(userId, nodes);
    }
    const nodes = await this.prisma.node.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return this.mapNodesBatchToApiModel(userId, nodes);
  }

  private async getSubtreeNodes(userId: string, rootNodeId: string) {
    const root = await this.getRawNodeOrThrow(userId, rootNodeId);
    if (!root) throw new NotFoundException(`Node with ID ${rootNodeId} not found`);

    const ids: string[] = [root.id];
    const queue: string[] = [root.id];
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
    return this.mapNodesBatchToApiModel(userId, nodes);
  }

  // 获取单个节点
  async findOne(userId: string, id: string) {
    const raw = await this.getRawNodeOrThrow(userId, id);
    const node = await this.prisma.node.findFirst({
      where: { id: raw.id, userId },
    });

    if (!node) {
      throw new NotFoundException(`Node with ID ${id} not found`);
    }

    return this.mapNodeToApiModel(node, userId);
  }

  // 获取节点的所有子节点
  async findChildren(userId: string, parentId: string) {
    const parent = await this.getRawNodeOrThrow(userId, parentId);
    const nodes = await this.prisma.node.findMany({
      where: { userId, parentId: parent.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return this.mapNodesBatchToApiModel(userId, nodes);
  }

  // 获取节点及其所有子节点（树形结构）
  async findNodeWithChildren(userId: string, id: string): Promise<any> {
    const subtree = await this.getSubtreeNodes(userId, id);
    const mapped = await this.mapNodesBatchToApiModel(userId, subtree);
    const byId = new Map(mapped.map((n) => [n.id, { ...n, children: [] as any[] }]));
    let root: any = null;

    mapped.forEach((node) => {
      const target = byId.get(node.id);
      if (!target) return;
      if (!node.parentId || !byId.has(node.parentId)) {
        if (node.id === id) root = target;
        return;
      }
      byId.get(node.parentId)!.children.push(target);
    });

    if (!root) {
      throw new NotFoundException(`Node with ID ${id} not found`);
    }
    return root;
  }

  // 更新单个节点
  async update(userId: string, id: string, updateNodeDto: UpdateNodeDto) {
    const existing = await this.getRawNodeOrThrow(userId, id);
    let nextParentId = existing.parentId;

    if (updateNodeDto.parentId !== undefined) {
      if (updateNodeDto.parentId === null) {
        nextParentId = null;
      } else {
        const parent = await this.getRawNodeOrThrow(userId, updateNodeDto.parentId);
        nextParentId = parent.id;
      }
      await this.assertNoCycle(userId, id, updateNodeDto.parentId ?? null);
      if (nextParentId !== null) {
        const parentExists = await this.prisma.node.findFirst({
          where: { id: nextParentId, userId },
          select: { id: true },
        });
        if (!parentExists) {
          throw new BadRequestException(
            `父节点 ${nextParentId} 不存在，无法更新节点 ${id} 的层级关系`,
          );
        }
      }
    }

    // 显式构建 Prisma data，确保 supertagId / tags 等被正确写入（避免 spread 遗漏或键名不一致）
    const data: Prisma.NodeUncheckedUpdateInput = {
      parentId: nextParentId,
    };
    if (updateNodeDto.content !== undefined) data.content = updateNodeDto.content;
    if (updateNodeDto.nodeType !== undefined) data.nodeType = updateNodeDto.nodeType;
    if (updateNodeDto.sortOrder !== undefined) data.sortOrder = updateNodeDto.sortOrder;
    if (updateNodeDto.isCollapsed !== undefined) data.isCollapsed = updateNodeDto.isCollapsed;
    if (updateNodeDto.fields !== undefined) data.fields = updateNodeDto.fields as Prisma.InputJsonValue;
    if (updateNodeDto.payload !== undefined) data.payload = updateNodeDto.payload as Prisma.InputJsonValue;
    if (updateNodeDto.supertagId !== undefined) data.supertagId = updateNodeDto.supertagId ?? null;
    if (updateNodeDto.tags !== undefined) data.tags = updateNodeDto.tags;
    if (updateNodeDto.references !== undefined) {
      data.references =
        updateNodeDto.references != null
          ? (updateNodeDto.references as Prisma.InputJsonValue)
          : Prisma.JsonNull;
    }

    const node = await this.prisma.node.update({
      where: { id: existing.id },
      data,
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
    let nextParentId = existing.parentId;
    if (moveDto.newParentId !== undefined) {
      if (moveDto.newParentId === null) {
        nextParentId = null;
      } else {
        const parent = await this.getRawNodeOrThrow(userId, moveDto.newParentId);
        nextParentId = parent.id;
      }
    }
    await this.assertNoCycle(userId, id, moveDto.newParentId ?? null);

    const node = await this.prisma.node.update({
      where: { id: existing.id },
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
    
    if (!rawNode.parentId) {
      // 获取同级的前一个节点
      const siblings = await this.prisma.node.findMany({
        where: { userId, parentId: null, sortOrder: { lt: node.sortOrder } },
        orderBy: { sortOrder: 'desc' },
        select: { logicalId: true },
        take: 1,
      });

      if (siblings.length === 0) {
        throw new Error('No previous sibling to become parent');
      }

      return this.move(userId, id, { newParentId: siblings[0].logicalId });
    }

    const siblings = await this.prisma.node.findMany({
      where: { userId, parentId: rawNode.parentId, sortOrder: { lt: node.sortOrder } },
      orderBy: { sortOrder: 'desc' },
      select: { logicalId: true },
      take: 1,
    });

    if (siblings.length === 0) {
      throw new Error('No previous sibling to become parent');
    }

    return this.move(userId, id, { newParentId: siblings[0].logicalId });
  }

  // 反缩进节点（成为父节点的下一个兄弟节点）
  async outdent(userId: string, id: string) {
    const node = await this.findOne(userId, id);
    const rawNode = await this.getRawNodeOrThrow(userId, id);
    if (rawNode.nodeRole !== 'normal') {
      throw new ConflictException('结构根节点不能反缩进');
    }

    if (!rawNode.parentId) {
      throw new Error('Root nodes cannot be outdented');
    }

    const parentRaw = await this.prisma.node.findFirst({
      where: { userId, id: rawNode.parentId },
      select: { parentId: true },
    });
    const grandParentLogical = parentRaw?.parentId
      ? (await this.prisma.node.findFirst({
          where: { userId, id: parentRaw.parentId },
          select: { logicalId: true },
        }))?.logicalId ?? null
      : null;

    return this.move(userId, id, {
      newParentId: grandParentLogical ?? undefined,
      newSortOrder: node.sortOrder + 1,
    });
  }

  // 删除单个节点（包括其所有子节点）；禁止删除 user_root / daily_root
  async remove(userId: string, id: string) {
    const node = await this.getRawNodeOrThrow(userId, id);
    if (node.nodeRole !== 'normal') {
      throw new ConflictException('结构根节点不能通过通用删除接口删除');
    }

    const allNodes = await this.prisma.node.findMany({
      where: { userId },
      select: { id: true, parentId: true },
    });
    const childrenMap = new Map<string, string[]>();
    allNodes.forEach((n) => {
      if (!n.parentId) return;
      const arr = childrenMap.get(n.parentId) ?? [];
      arr.push(n.id);
      childrenMap.set(n.parentId, arr);
    });

    const idsToDelete = new Set<string>([node.id]);
    const queue = [node.id];
    while (queue.length) {
      const current = queue.shift()!;
      (childrenMap.get(current) ?? []).forEach((child) => {
        if (idsToDelete.has(child)) return;
        idsToDelete.add(child);
        queue.push(child);
      });
    }

    await this.prisma.node.deleteMany({
      where: { userId, id: { in: [...idsToDelete] } },
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
    return this.mapNodesBatchToApiModel(userId, nodes);
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
    return this.mapNodesBatchToApiModel(userId, nodes);
  }

  // 切换节点折叠状态
  async toggleCollapse(userId: string, id: string) {
    const raw = await this.getRawNodeOrThrow(userId, id);
    const node = await this.prisma.node.findFirst({ where: { id: raw.id, userId } });
    if (!node) throw new NotFoundException(`Node with ID ${id} not found`);

    const updated = await this.prisma.node.update({
      where: { id: raw.id },
      data: { isCollapsed: !node.isCollapsed },
    });
    return this.mapNodeToApiModel(updated, userId);
  }

  async getDailyInitializationStatus(userId: string) {
    const needsInitialization = await this.checkNeedsDailyInitialization(userId);
    return { success: true, needsInitialization };
  }

  async initializeDailyNotes(userId: string) {
    await this.ensureStructuralRoots(userId);
    const today = startOfDay(new Date());
    const calendarPath = this.getCalendarPath(today);
    const dayOfWeek = getDay(today);
    const offsetToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const daysToCreate = Array.from({ length: offsetToMonday + 1 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - offsetToMonday + i);
      return d;
    });

    const dailyRoot = await this.getRawNodeOrThrow(userId, `daily-root-${userId}`);

    const yearNode = await this.prisma.node.upsert({
      where: { userId_logicalId: { userId, logicalId: calendarPath.yearId } },
      create: {
        id: uuidv4(),
        logicalId: calendarPath.yearId,
        userId,
        parentId: dailyRoot.id,
        content: calendarPath.yearContent,
        nodeType: 'daily',
        tags: ['sys:calendar:year'],
        payload: { level: 'year', year: getISOWeekYear(today) } as Prisma.InputJsonValue,
      },
      update: {
        parentId: dailyRoot.id,
        content: calendarPath.yearContent,
      },
    });

    const weekNode = await this.prisma.node.upsert({
      where: { userId_logicalId: { userId, logicalId: calendarPath.weekId } },
      create: {
        id: uuidv4(),
        logicalId: calendarPath.weekId,
        userId,
        parentId: yearNode.id,
        content: calendarPath.weekContent,
        nodeType: 'daily',
        tags: ['sys:calendar:week'],
        payload: {
          level: 'week',
          year: getISOWeekYear(today),
          week: getISOWeek(today),
        } as Prisma.InputJsonValue,
      },
      update: {
        parentId: yearNode.id,
        content: calendarPath.weekContent,
      },
    });

    const createdDayIds: string[] = [];
    for (let i = 0; i < daysToCreate.length; i++) {
      const date = daysToCreate[i];
      const path = this.getCalendarPath(date);
      await this.prisma.node.upsert({
        where: { userId_logicalId: { userId, logicalId: path.dayId } },
        create: {
          id: uuidv4(),
          logicalId: path.dayId,
          userId,
          parentId: weekNode.id,
          content: path.dayContent,
          nodeType: 'daily',
          sortOrder: i,
          tags: ['sys:calendar:day'],
          payload: {
            level: 'day',
            year: getYear(date),
            month: getMonth(date) + 1,
            week: getISOWeek(date),
            day: getDate(date),
            dateString: format(date, 'yyyy-MM-dd'),
          } as Prisma.InputJsonValue,
        },
        update: {
          parentId: weekNode.id,
          sortOrder: i,
        },
      });
      createdDayIds.push(path.dayId);
    }

    return {
      success: true,
      initialized: true,
      data: {
        yearId: yearNode.logicalId,
        weekId: weekNode.logicalId,
        dayIds: createdDayIds,
      },
    };
  }

  async runCalendarDiagnostic(userId: string) {
    const issues = await this.collectCalendarIssues(userId);
    return {
      userId,
      scannedAt: new Date().toISOString(),
      summary: { issuesFound: issues.length },
      issues,
    };
  }

  async repairCalendarHierarchy(
    userId: string,
    body: { items?: Array<{ nodeId: string; expectedParentId: string | null }>; dryRun?: boolean; auto?: boolean },
  ) {
    const dryRun = body.dryRun ?? false;
    const auto = body.auto ?? false;
    const issues = await this.collectCalendarIssues(userId);
    const items =
      auto || !body.items?.length
        ? issues.map((i) => ({ nodeId: i.nodeId, expectedParentId: i.expectedParentId }))
        : body.items;

    const results: Array<{
      nodeId: string;
      oldParentId: string | null;
      newParentId: string | null;
      success: boolean;
      issueCode?: DiagnosticIssueCode;
      error?: string;
    }> = [];

    for (const item of items) {
      const node = await this.prisma.node.findFirst({
        where: { userId, logicalId: item.nodeId },
        select: { id: true, parentId: true, logicalId: true },
      });
      if (!node) {
        results.push({
          nodeId: item.nodeId,
          oldParentId: null,
          newParentId: item.expectedParentId,
          success: false,
          issueCode: 'CROSS_USER_PARENT',
          error: 'Node not found',
        });
        continue;
      }

      const oldParent = node.parentId
        ? await this.prisma.node.findFirst({
            where: { userId, id: node.parentId },
            select: { logicalId: true },
          })
        : null;

      const targetParent = item.expectedParentId
        ? await this.prisma.node.findFirst({
            where: { userId, logicalId: item.expectedParentId },
            select: { id: true },
          })
        : null;

      if (item.expectedParentId && !targetParent) {
        results.push({
          nodeId: item.nodeId,
          oldParentId: oldParent?.logicalId ?? null,
          newParentId: item.expectedParentId,
          success: false,
          issueCode: 'MISSING_ANCHOR',
          error: 'Expected parent not found',
        });
        continue;
      }

      if (!dryRun) {
        await this.prisma.node.update({
          where: { id: node.id },
          data: { parentId: targetParent?.id ?? null },
        });
      }

      results.push({
        nodeId: item.nodeId,
        oldParentId: oldParent?.logicalId ?? null,
        newParentId: item.expectedParentId,
        success: true,
        issueCode: 'WRONG_PARENT',
      });
    }

    return {
      userId,
      repairedAt: new Date().toISOString(),
      dryRun,
      summary: {
        totalRequested: items.length,
        successCount: results.filter((r) => r.success).length,
        failedCount: results.filter((r) => !r.success).length,
      },
      results,
    };
  }

  private async checkNeedsDailyInitialization(userId: string): Promise<boolean> {
    const dailyRoot = await this.prisma.node.findFirst({
      where: { userId, logicalId: `daily-root-${userId}` },
      select: { id: true },
    });
    if (!dailyRoot) return true;

    const todayPath = this.getCalendarPath(startOfDay(new Date()));
    const dayNode = await this.prisma.node.findFirst({
      where: { userId, logicalId: todayPath.dayId },
      select: { parentId: true },
    });
    if (!dayNode) return true;

    let cursor = dayNode.parentId;
    while (cursor) {
      if (cursor === dailyRoot.id) return false;
      const parent = await this.prisma.node.findFirst({
        where: { userId, id: cursor },
        select: { parentId: true },
      });
      cursor = parent?.parentId ?? null;
    }
    return true;
  }

  private parseCalendarNodeId(nodeId: string): {
    type: CalendarNodeType | null;
    year?: number;
    weekYear?: number;
    weekNumber?: number;
    month?: number;
    day?: number;
  } {
    const yearMatch = nodeId.match(/^year-(\d{4})$/);
    if (yearMatch) return { type: 'year', year: parseInt(yearMatch[1], 10) };
    const weekMatch = nodeId.match(/^week-(\d{4})-(\d{2})$/);
    if (weekMatch) {
      return {
        type: 'week',
        weekYear: parseInt(weekMatch[1], 10),
        weekNumber: parseInt(weekMatch[2], 10),
      };
    }
    const dayMatch = nodeId.match(/^day-(\d{4})-(\d{2})-(\d{2})$/);
    if (dayMatch) {
      return {
        type: 'day',
        year: parseInt(dayMatch[1], 10),
        month: parseInt(dayMatch[2], 10),
        day: parseInt(dayMatch[3], 10),
      };
    }
    return { type: null };
  }

  private async collectCalendarIssues(userId: string): Promise<CalendarDiagnosticIssue[]> {
    const rows = await this.prisma.node.findMany({
      where: {
        userId,
        OR: [
          { logicalId: { startsWith: 'year-' } },
          { logicalId: { startsWith: 'week-' } },
          { logicalId: { startsWith: 'day-' } },
        ],
      },
      select: { logicalId: true, parentId: true },
    });

    const parentIds = [...new Set(rows.map((r) => r.parentId).filter((v): v is string => !!v))];
    const parents = parentIds.length
      ? await this.prisma.node.findMany({
          where: { userId, id: { in: parentIds } },
          select: { id: true, logicalId: true },
        })
      : [];
    const parentMap = new Map(parents.map((p) => [p.id, p.logicalId]));

    const allNodes = rows.map((r) => ({
      id: r.logicalId,
      parentId: r.parentId ? parentMap.get(r.parentId) ?? null : null,
    }));
    const years = allNodes.filter((n) => n.id.startsWith('year-'));
    const weeks = allNodes.filter((n) => n.id.startsWith('week-'));
    const days = allNodes.filter((n) => n.id.startsWith('day-'));
    const dailyRootId = `daily-root-${userId}`;

    const issues: CalendarDiagnosticIssue[] = [];
    years.forEach((year) => {
      if (year.parentId !== dailyRootId) {
        issues.push({
          issueCode: 'WRONG_PARENT',
          nodeId: year.id,
          nodeType: 'year',
          currentParentId: year.parentId,
          expectedParentId: dailyRootId,
          expectedParentType: 'daily_root',
        });
      }
    });
    weeks.forEach((week) => {
      const parsed = this.parseCalendarNodeId(week.id);
      if (parsed.type !== 'week' || !parsed.weekYear) return;
      const expected = `year-${parsed.weekYear}`;
      if (week.parentId !== expected) {
        issues.push({
          issueCode: 'WRONG_PARENT',
          nodeId: week.id,
          nodeType: 'week',
          currentParentId: week.parentId,
          expectedParentId: expected,
          expectedParentType: 'year',
        });
      }
    });
    days.forEach((day) => {
      const parsed = this.parseCalendarNodeId(day.id);
      if (parsed.type !== 'day' || !parsed.year || !parsed.month || !parsed.day) return;
      const d = new Date(parsed.year, parsed.month - 1, parsed.day);
      const expected = `week-${getISOWeekYear(d)}-${String(getISOWeek(d)).padStart(2, '0')}`;
      if (day.parentId !== expected) {
        issues.push({
          issueCode: 'WRONG_PARENT',
          nodeId: day.id,
          nodeType: 'day',
          currentParentId: day.parentId,
          expectedParentId: expected,
          expectedParentType: 'week',
        });
      }
    });
    return issues;
  }

  /**
   * 清理孤儿节点：删除所有 parentId=null 且 nodeRole='normal' 的节点及其子树
   * 孤儿节点定义：parentId 为 null 但不是结构根节点（user_root/daily_root）
   */
  async cleanupOrphanNodes(userId: string): Promise<{
    deletedCount: number;
    deletedIds: string[];
  }> {
    const nodes = await this.prisma.node.findMany({
      where: { userId },
      select: { id: true, parentId: true, nodeRole: true },
    });
    const orphanRootIds = nodes
      .filter((n) => n.parentId === null && n.nodeRole === 'normal')
      .map((n) => n.id);

    if (orphanRootIds.length === 0) return { deletedCount: 0, deletedIds: [] };

    const childrenMap = new Map<string, string[]>();
    nodes.forEach((node) => {
      if (!node.parentId) return;
      const arr = childrenMap.get(node.parentId) ?? [];
      arr.push(node.id);
      childrenMap.set(node.parentId, arr);
    });

    const toDelete = new Set<string>();
    const queue = [...orphanRootIds];
    while (queue.length) {
      const current = queue.shift()!;
      if (toDelete.has(current)) continue;
      toDelete.add(current);
      (childrenMap.get(current) ?? []).forEach((child) => queue.push(child));
    }

    const ids = [...toDelete];
    await this.prisma.node.deleteMany({
      where: { userId, id: { in: ids } },
    });
    return { deletedCount: ids.length, deletedIds: ids };
  }
}

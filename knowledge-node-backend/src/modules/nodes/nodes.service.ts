import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EdgesService } from '../edges/edges.service';
import { StatusMachineService } from '../status-machine/status-machine.service';
import {
  CreateNodeDto,
  UpdateNodeDto,
  BatchCreateNodesDto,
  BatchUpdateNodesDto,
} from './dto/node.dto';
import { SearchConditionDto, SearchQueryDto } from './dto/search-query.dto';
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
  blockedBy?: { id: string; content: string }[];
};

type MentionedByItem = {
  node: NodeApiModel;
  breadcrumbs: Array<{ id: string; title: string }>;
  sourceType: 'reference' | 'field';
  fieldKey?: string;
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
  constructor(
    private prisma: PrismaService,
    private edgesService: EdgesService,
    private statusMachine: StatusMachineService,
  ) {}

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

  private readonly weekdayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  private getCalendarPath(date: Date) {
    const isoWeekYear = getISOWeekYear(date);
    const weekNumber = getISOWeek(date);
    const weekPadded = String(weekNumber).padStart(2, '0');
    const yearId = `year-${isoWeekYear}`;
    const weekId = `week-${isoWeekYear}-${weekPadded}`;
    const dayId = `day-${format(date, 'yyyy-MM-dd')}`;
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return {
      yearId,
      weekId,
      dayId,
      yearContent: `${isoWeekYear}年`,
      weekContent: `${isoWeekYear}年第${weekNumber}周`,
      dayContent: `${month}月${day}日 ${this.weekdayNames[getDay(date)]}`,
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

  private extractMentionTargetsFromReferences(references: unknown): string[] {
    if (!Array.isArray(references)) return [];
    return references
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const targetNodeId = (item as { targetNodeId?: unknown }).targetNodeId;
        return typeof targetNodeId === 'string' && targetNodeId.trim() ? targetNodeId.trim() : null;
      })
      .filter((id): id is string => !!id);
  }

  private extractMentionTargetsFromFields(fields: Record<string, unknown>): string[] {
    const targets: string[] = [];
    for (const value of Object.values(fields ?? {})) {
      if (!value) continue;
      if (typeof value === 'object' && !Array.isArray(value)) {
        const nodeId = (value as { nodeId?: unknown }).nodeId;
        if (typeof nodeId === 'string' && nodeId.trim()) {
          targets.push(nodeId.trim());
        }
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (!item || typeof item !== 'object') continue;
          const nodeId = (item as { nodeId?: unknown }).nodeId;
          if (typeof nodeId === 'string' && nodeId.trim()) {
            targets.push(nodeId.trim());
          }
        }
      }
    }
    return targets;
  }

  private collectMentionTargetLogicalIds(references: unknown, fields: Record<string, unknown>): string[] {
    const fromReferences = this.extractMentionTargetsFromReferences(references);
    const fromFields = this.extractMentionTargetsFromFields(fields);
    return [...new Set([...fromReferences, ...fromFields])];
  }

  private inferMentionSourceMeta(
    sourceNode: { references: unknown; fields: unknown },
    targetLogicalId: string,
  ): { sourceType: 'reference' | 'field'; fieldKey?: string } {
    const fields = (sourceNode.fields as Record<string, unknown>) ?? {};
    for (const [fieldKey, value] of Object.entries(fields)) {
      if (!value) continue;
      if (typeof value === 'object' && !Array.isArray(value)) {
        const nodeId = (value as { nodeId?: unknown }).nodeId;
        if (nodeId === targetLogicalId) {
          return { sourceType: 'field', fieldKey };
        }
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (!item || typeof item !== 'object') continue;
          const nodeId = (item as { nodeId?: unknown }).nodeId;
          if (nodeId === targetLogicalId) {
            return { sourceType: 'field', fieldKey };
          }
        }
      }
    }

    const refs = this.extractMentionTargetsFromReferences(sourceNode.references);
    if (refs.includes(targetLogicalId)) {
      return { sourceType: 'reference' };
    }

    return { sourceType: 'reference' };
  }

  private async syncMentionEdgesForNode(
    userId: string,
    sourceLogicalId: string,
    references: unknown,
    fields: Record<string, unknown>,
  ) {
    const targetLogicalIds = this
      .collectMentionTargetLogicalIds(references, fields)
      .filter((targetId) => targetId !== sourceLogicalId);
    await this.edgesService.syncMentionOutEdgesForSource(userId, sourceLogicalId, targetLogicalIds);
  }

  private async buildNodeBreadcrumbs(userId: string, nodePhysicalId: string): Promise<Array<{ id: string; title: string }>> {
    const breadcrumbs: Array<{ id: string; title: string }> = [];
    let parentPhysicalId = await this.edgesService.getContainsParentPhysicalId(userId, nodePhysicalId);

    while (parentPhysicalId) {
      const parentNode = await this.prisma.node.findFirst({
        where: { id: parentPhysicalId, userId },
        select: { id: true, logicalId: true, content: true },
      });
      if (!parentNode) break;

      breadcrumbs.unshift({
        id: parentNode.logicalId,
        title: parentNode.content?.trim() || '未命名',
      });
      parentPhysicalId = await this.edgesService.getContainsParentPhysicalId(userId, parentNode.id);
    }

    return breadcrumbs;
  }

  /**
   * Write Guard：当 #todo 当前为 Locked 且请求将其置为 Done 时，若有未解除的 BLOCKS 前置则抛 409。（由状态机配置判定“已解除”）
   */
  private async assertTodoNotBlockedWhenSettingDone(userId: string, targetPhysicalId: string): Promise<void> {
    const inEdges = await this.prisma.networkEdge.findMany({
      where: { targetNodeId: targetPhysicalId, edgeType: 'BLOCKS' },
      select: { sourceNodeId: true },
    });
    if (inEdges.length === 0) return;
    const sourceIds = inEdges.map((e) => e.sourceNodeId);
    const sources = await this.prisma.node.findMany({
      where: { id: { in: sourceIds }, userId },
      select: {
        id: true,
        fields: true,
        supertag: { select: { name: true } },
      },
    });
    for (const src of sources) {
      const tagName = src.supertag?.name ?? '';
      const fields = (src.fields as Record<string, unknown>) ?? {};
      const fieldKey = await this.statusMachine.getStatusFieldKey(tagName);
      const statusValue = (fieldKey ? (fields[fieldKey] as string) : undefined) ?? '';
      const resolved =
        await this.statusMachine.isResolved(tagName, statusValue) ||
        (await this.statusMachine.isDone(tagName, statusValue));
      if (!resolved) {
        throw new ConflictException('存在未解除的阻塞前置项，无法直接闭环');
      }
    }
  }

  /**
   * 级联重算下游 todo 状态：找出被该节点 BLOCKS 的所有 todo，对每个重算阻塞状态。
   * 返回状态从 Locked->Ready（被解锁）的节点 logicalId 列表，用于通知前端刷新。
   */
  private async cascadeRecomputeDownstreamTodos(userId: string, blockerNodePhysicalId: string): Promise<string[]> {
    const todoFieldKey = await this.statusMachine.getStatusFieldKey('todo');
    const blockedState = await this.statusMachine.getBlockedState('todo').then((s) => s ?? 'Locked');
    const unblockedState = await this.statusMachine.getUnblockedState('todo').then((s) => s ?? 'Ready');

    const outEdges = await this.prisma.networkEdge.findMany({
      where: { sourceNodeId: blockerNodePhysicalId, edgeType: 'BLOCKS' },
      select: { targetNodeId: true },
    });
    const targetPhysicalIds = [...new Set(outEdges.map((e) => e.targetNodeId))];
    const unlockedLogicalIds: string[] = [];
    for (const targetPhysicalId of targetPhysicalIds) {
      const before = await this.prisma.node.findFirst({
        where: { id: targetPhysicalId, userId },
        select: { logicalId: true, fields: true },
      });
      const beforeStatus = (todoFieldKey && before?.fields)
        ? ((before.fields as Record<string, unknown>)[todoFieldKey] as string | undefined) ?? null
        : (before?.fields as Record<string, unknown> | undefined)?.todo_status ?? null;

      await this.edgesService['recomputeTodoStatusForTarget']?.(userId, targetPhysicalId as string);

      const after = await this.prisma.node.findFirst({
        where: { id: targetPhysicalId, userId },
        select: { logicalId: true, fields: true },
      });
      const afterStatus = (todoFieldKey && after?.fields)
        ? ((after.fields as Record<string, unknown>)[todoFieldKey] as string | undefined) ?? null
        : (after?.fields as Record<string, unknown> | undefined)?.todo_status ?? null;

      if (beforeStatus === blockedState && afterStatus === unblockedState && after?.logicalId) {
        unlockedLogicalIds.push(after.logicalId);
      }
    }
    return unlockedLogicalIds;
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
    const [parentPhysicalId, childPhysicalIds] = await Promise.all([
      this.edgesService.getContainsParentPhysicalId(userId, node.id),
      this.edgesService.getContainsChildrenPhysicalIds(userId, node.id),
    ]);
    const parentLogicalId =
      parentPhysicalId == null
        ? null
        : (await this.prisma.node.findFirst({
            where: { userId, id: parentPhysicalId },
            select: { logicalId: true },
          }))?.logicalId ?? null;
    const nodes = await this.prisma.node.findMany({
      where: { userId, id: { in: childPhysicalIds } },
      select: { id: true, logicalId: true },
    });
    const idToLogical = new Map(nodes.map((n) => [n.id, n.logicalId]));
    const childrenIds = childPhysicalIds.map((id) => idToLogical.get(id) ?? id);

    let blockedBy: { id: string; content: string }[] | undefined;
    if (node.supertagId) {
      const supertag = await this.prisma.tagTemplate.findUnique({
        where: { id: node.supertagId },
        select: { name: true },
      });
      if (supertag?.name === 'todo') {
        const inEdges = await this.prisma.networkEdge.findMany({
          where: { targetNodeId: node.id, edgeType: 'BLOCKS' },
          select: { sourceNodeId: true },
        });
        if (inEdges.length > 0) {
          const sourceNodes = await this.prisma.node.findMany({
            where: { id: { in: inEdges.map((e) => e.sourceNodeId) }, userId },
            select: { logicalId: true, content: true },
          });
          blockedBy = sourceNodes.map((n) => ({ id: n.logicalId, content: n.content ?? '' }));
        }
      }
    }

    return {
      id: node.logicalId,
      serverId: node.id,
      content: node.content,
      type: node.nodeType,
      nodeRole: node.nodeRole ?? undefined,
      parentId: parentLogicalId,
      appliedParentId: parentLogicalId,
      appliedSortOrder: node.sortOrder,
      sortOrder: node.sortOrder,
      childrenIds,
      isCollapsed: node.isCollapsed,
      tags: node.tags ?? [],
      references: (Array.isArray(node.references) ? node.references : []) as unknown[],
      supertagId: node.supertagId,
      fields: (node.fields as Record<string, unknown>) ?? {},
      payload: (node.payload as Record<string, unknown>) ?? {},
      createdAt: node.createdAt.getTime(),
      updatedAt: node.updatedAt.getTime(),
      blockedBy,
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
    const [parentMap, childrenMap] = await Promise.all([
      this.edgesService.getContainsParentLogicalIds(userId, nodePhysicalIds),
      this.edgesService.getContainsChildrenLogicalIds(userId, nodePhysicalIds),
    ]);

    return nodes.map((node) => ({
      id: node.logicalId,
      serverId: node.id,
      content: node.content,
      type: node.nodeType,
      nodeRole: node.nodeRole ?? undefined,
      parentId: parentMap.get(node.id) ?? null,
      appliedParentId: parentMap.get(node.id) ?? null,
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
    if (createNodeDto.parentId) {
      await this.edgesService.ensureContainsEdge(userId, createNodeDto.parentId, logicalId);
    }
    await this.syncMentionEdgesForNode(
      userId,
      logicalId,
      node.references,
      ((node.fields as Record<string, unknown>) ?? {}),
    );
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
      const childIds = await this.edgesService.getContainsChildrenPhysicalIds(userId, currentId);
      if (childIds.length > 0) {
        ids.push(...childIds);
        queue.push(...childIds);
      }
    }

    return this.prisma.node.findMany({
      where: { userId, id: { in: ids } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  // 获取根级别节点（无 CONTAINS 入边的节点）
  async findRootNodes(userId: string) {
    await this.ensureStructuralRoots(userId);
    const userNodeIds = (await this.prisma.node.findMany({
      where: { userId },
      select: { id: true },
    })).map((n) => n.id);
    if (userNodeIds.length === 0) return [];
    const withParent = await this.prisma.networkEdge.findMany({
      where: { edgeType: 'CONTAINS', targetNodeId: { in: userNodeIds } },
      select: { targetNodeId: true },
    });
    const targetSet = new Set(withParent.map((e) => e.targetNodeId));
    const rootIds = userNodeIds.filter((id) => !targetSet.has(id));
    const nodes = await this.prisma.node.findMany({
      where: { userId, id: { in: rootIds } },
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

  // 获取节点的所有子节点（按 CONTAINS 出边，顺序同 sortOrder）
  async findChildren(userId: string, parentId: string) {
    const parent = await this.getRawNodeOrThrow(userId, parentId);
    const childPhysicalIds = await this.edgesService.getContainsChildrenPhysicalIds(userId, parent.id);
    if (childPhysicalIds.length === 0) return [];
    const nodes = await this.prisma.node.findMany({
      where: { userId, id: { in: childPhysicalIds } },
    });
    const orderMap = new Map(childPhysicalIds.map((id, i) => [id, i]));
    nodes.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
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

  // 更新单个节点（切边后层级只维护 CONTAINS 边，不写 Node.parentId）
  async update(userId: string, id: string, updateNodeDto: UpdateNodeDto) {
    const existing = await this.getRawNodeOrThrow(userId, id);

    if (updateNodeDto.parentId !== undefined) {
      if (updateNodeDto.parentId === null) {
        await this.edgesService.removeContainsInEdgeForTarget(userId, id);
      } else {
        await this.edgesService.ensureContainsEdge(userId, updateNodeDto.parentId, id);
      }
    }

    // Write Guard：Locked 的 #todo 在存在未解除 BLOCKS 前置时禁止置为 Done（状态字段与取值由状态机配置决定）
    const todoFieldKey = await this.statusMachine.getStatusFieldKey('todo');
    const todoDoneState = (await this.statusMachine.getStatusConfig('todo'))?.config.doneState ?? 'Done';
    const requestedDone = updateNodeDto.fields && todoFieldKey && updateNodeDto.fields[todoFieldKey] === todoDoneState;
    if (requestedDone) {
      const current = await this.prisma.node.findFirst({
        where: { id: existing.id, userId },
        select: { id: true, fields: true, supertag: { select: { name: true } } },
      });
      const tagName = current?.supertag?.name ?? '';
      const currentFields = (current?.fields as Record<string, unknown>) ?? {};
      const currentStatus = (todoFieldKey ? currentFields[todoFieldKey] : currentFields.todo_status) as string | undefined;
      const isLocked = tagName === 'todo' && (await this.statusMachine.isBlocked('todo', currentStatus ?? ''));
      if (isLocked) {
        await this.assertTodoNotBlockedWhenSettingDone(userId, existing.id);
      }
    }

    // 在 update 前快照旧 fields，用于后续级联判定是否发生状态变更
    let fieldsBeforeUpdate: Record<string, unknown> | null = null;
    if (updateNodeDto.fields !== undefined) {
      const snap = await this.prisma.node.findFirst({
        where: { id: existing.id, userId },
        select: { fields: true },
      });
      fieldsBeforeUpdate = (snap?.fields as Record<string, unknown>) ?? {};
    }

    const data: Prisma.NodeUncheckedUpdateInput = {};
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

    if (updateNodeDto.references !== undefined || updateNodeDto.fields !== undefined) {
      await this.syncMentionEdgesForNode(
        userId,
        existing.logicalId,
        node.references,
        ((node.fields as Record<string, unknown>) ?? {}),
      );
    }

    if (updateNodeDto.fields !== undefined && node.supertagId) {
      const supertag = await this.prisma.tagTemplate.findUnique({
        where: { id: node.supertagId },
        select: { name: true },
      });
      const tagName = supertag?.name ?? '';
      const fields = (node.fields as Record<string, unknown>) ?? {};
      if (tagName === 'todo' && fields.todo_deps != null) {
        const deps = Array.isArray(fields.todo_deps) ? fields.todo_deps : [fields.todo_deps];
        const sourceIds = deps.map((d: unknown) => (typeof d === 'object' && d && 'nodeId' in d ? (d as { nodeId: string }).nodeId : String(d))).filter(Boolean);
        await this.edgesService.syncBlocksInEdgesForTarget(userId, id, sourceIds);
      }
      if (tagName === '灵感' && fields.idea_blockers != null) {
        const blockers = Array.isArray(fields.idea_blockers) ? fields.idea_blockers : [fields.idea_blockers];
        const targetIds = blockers.map((b: unknown) => (typeof b === 'object' && b && 'nodeId' in b ? (b as { nodeId: string }).nodeId : String(b))).filter(Boolean);
        await this.edgesService.syncResolvesOutEdgesForSource(userId, id, targetIds);
      }
    }

    let unlockedNodeIds: string[] = [];
    if (updateNodeDto.fields !== undefined && node.supertagId) {
      const tagNameForCascade = (await this.prisma.tagTemplate.findUnique({
        where: { id: node.supertagId },
        select: { name: true },
      }))?.name ?? '';
      const statusFieldKey = await this.statusMachine.getStatusFieldKey(tagNameForCascade);
      if (statusFieldKey && fieldsBeforeUpdate) {
        const fieldsBefore = fieldsBeforeUpdate;
        const fieldsAfterUpdate = (node.fields as Record<string, unknown>) ?? {};
        const statusBefore = (fieldsBefore[statusFieldKey] as string | undefined) ?? '';
        const statusAfter = (fieldsAfterUpdate[statusFieldKey] as string | undefined) ?? '';
        if (statusBefore !== statusAfter) {
          const hasBlocksOut = await this.prisma.networkEdge.count({
            where: { sourceNodeId: node.id, edgeType: 'BLOCKS' },
          });
          if (hasBlocksOut > 0) {
            unlockedNodeIds = await this.cascadeRecomputeDownstreamTodos(userId, node.id);
          }
        }
      }
    }

    const apiNode = await this.mapNodeToApiModel(node, userId);
    return { node: apiNode, unlockedNodeIds };
  }

  // 批量更新节点（单条 update 返回 { node, unlockedNodeIds }，批量只返回 node 数组）
  async batchUpdate(userId: string, batchUpdateDto: BatchUpdateNodesDto) {
    const results = await Promise.all(
      batchUpdateDto.nodes.map(async (node) => {
        const { id, ...updateData } = node;
        const out = await this.update(userId, id, updateData);
        return out.node;
      })
    );
    return results;
  }

  // 删除单个节点（包括其所有子节点）；禁止删除 user_root / daily_root；子节点通过 CONTAINS 边推导
  async remove(userId: string, id: string) {
    const node = await this.getRawNodeOrThrow(userId, id);
    if (node.nodeRole !== 'normal') {
      throw new ConflictException('结构根节点不能通过通用删除接口删除');
    }

    const idsToDelete = new Set<string>([node.id]);
    const queue = [node.id];
    while (queue.length) {
      const current = queue.shift()!;
      const childIds = await this.edgesService.getContainsChildrenPhysicalIds(userId, current);
      for (const childId of childIds) {
        if (idsToDelete.has(childId)) continue;
        idsToDelete.add(childId);
        queue.push(childId);
      }
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

  async findMentionedBy(userId: string, id: string): Promise<MentionedByItem[]> {
    const mentionEdges = await this.edgesService.findMentionInEdgesForTarget(userId, id);
    if (mentionEdges.length === 0) return [];

    const sourceLogicalIds = [...new Set(mentionEdges.map((e) => e.sourceNodeId).filter(Boolean))];
    if (sourceLogicalIds.length === 0) return [];

    const sourceNodes = await this.prisma.node.findMany({
      where: {
        userId,
        logicalId: { in: sourceLogicalIds },
      },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        logicalId: true,
        content: true,
        nodeType: true,
        nodeRole: true,
        parentId: true,
        sortOrder: true,
        isCollapsed: true,
        supertagId: true,
        tags: true,
        references: true,
        fields: true,
        payload: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (sourceNodes.length === 0) return [];

    const apiNodes = await this.mapNodesBatchToApiModel(userId, sourceNodes);
    const logicalIdToApiNode = new Map(apiNodes.map((n) => [n.id, n]));

    const items: MentionedByItem[] = [];
    for (const sourceNode of sourceNodes) {
      const apiNode = logicalIdToApiNode.get(sourceNode.logicalId);
      if (!apiNode) continue;

      const breadcrumbs = await this.buildNodeBreadcrumbs(userId, sourceNode.id);
      const meta = this.inferMentionSourceMeta(sourceNode, id);
      items.push({
        node: apiNode,
        breadcrumbs,
        sourceType: meta.sourceType,
        fieldKey: meta.fieldKey,
      });
    }

    return items;
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

  private evaluateFieldCondition(fieldValue: unknown, condition: SearchConditionDto): boolean {
    if (condition.operator === 'contains') {
      return String(fieldValue ?? '').toLowerCase().includes(String(condition.value).toLowerCase());
    }
    if (condition.operator === 'gt') {
      return Number(fieldValue) > Number(condition.value);
    }
    if (condition.operator === 'lt') {
      return Number(fieldValue) < Number(condition.value);
    }
    if (condition.operator === 'gte') {
      return Number(fieldValue) >= Number(condition.value);
    }
    if (condition.operator === 'lte') {
      return Number(fieldValue) <= Number(condition.value);
    }
    if (condition.operator === 'hasAny') {
      const expected = Array.isArray(condition.value) ? condition.value : [condition.value];
      const current = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
      return expected.some((item) => current.includes(item));
    }
    if (condition.operator === 'hasAll') {
      const expected = Array.isArray(condition.value) ? condition.value : [condition.value];
      const current = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
      return expected.every((item) => current.includes(item));
    }
    if (condition.operator === 'isNot') {
      return fieldValue !== condition.value;
    }
    return fieldValue === condition.value;
  }

  private evaluateDateCondition(dateValue: Date, condition: SearchConditionDto): boolean {
    if (condition.operator === 'today') {
      const target = startOfDay(new Date());
      return startOfDay(dateValue).getTime() === target.getTime();
    }
    if (condition.operator === 'withinDays') {
      const days = Number(condition.value);
      const boundary = Date.now() - days * 24 * 60 * 60 * 1000;
      return dateValue.getTime() >= boundary;
    }

    const conditionDate = new Date(String(condition.value));
    if (Number.isNaN(conditionDate.getTime())) {
      return false;
    }
    if (condition.operator === 'gt') return dateValue.getTime() > conditionDate.getTime();
    if (condition.operator === 'lt') return dateValue.getTime() < conditionDate.getTime();
    if (condition.operator === 'gte') return dateValue.getTime() >= conditionDate.getTime();
    if (condition.operator === 'lte') return dateValue.getTime() <= conditionDate.getTime();
    return startOfDay(dateValue).getTime() === startOfDay(conditionDate).getTime();
  }

  private isDescendantOf(
    nodeId: string,
    ancestorLogicalId: string,
    parentMapById: Map<string, string | null>,
    logicalIdMapById: Map<string, string>,
  ): boolean {
    let cursor = parentMapById.get(nodeId) ?? null;
    while (cursor) {
      if (logicalIdMapById.get(cursor) === ancestorLogicalId) {
        return true;
      }
      cursor = parentMapById.get(cursor) ?? null;
    }
    return false;
  }

  async advancedSearch(userId: string, query: SearchQueryDto) {
    const take = query.take ?? 50;
    const rows = await this.prisma.node.findMany({
      where: { userId, nodeRole: 'normal' },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        logicalId: true,
        content: true,
        nodeType: true,
        nodeRole: true,
        parentId: true,
        sortOrder: true,
        isCollapsed: true,
        supertagId: true,
        tags: true,
        references: true,
        fields: true,
        payload: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const parentMapById = new Map(rows.map((row) => [row.id, row.parentId]));
    const logicalIdMapById = new Map(rows.map((row) => [row.id, row.logicalId]));

    const matchesCondition = (row: (typeof rows)[number], condition: SearchConditionDto): boolean => {
      const evaluate = (): boolean => {
        if (condition.type === 'keyword') {
          const keyword = String(condition.value).toLowerCase();
          return row.content.toLowerCase().includes(keyword);
        }

        if (condition.type === 'tag') {
          const values = Array.isArray(condition.value) ? condition.value : [condition.value];
          if (condition.operator === 'hasAll') {
            return values.every((value) => typeof value === 'string' && row.tags.includes(value));
          }
          return values.some((value) => typeof value === 'string' && row.tags.includes(value));
        }

        if (condition.type === 'field') {
          if (!condition.field) return false;
          const fields = (row.fields as Record<string, unknown>) ?? {};
          const fieldValue = fields[condition.field];
          return this.evaluateFieldCondition(fieldValue, condition);
        }

        if (condition.type === 'ancestor') {
          const ancestorLogicalId = String(condition.value);
          return this.isDescendantOf(row.id, ancestorLogicalId, parentMapById, logicalIdMapById);
        }

        if (condition.type === 'date') {
          const field = condition.field === 'createdAt' ? 'createdAt' : 'updatedAt';
          return this.evaluateDateCondition(row[field], condition);
        }

        return false;
      };

      const matched = evaluate();
      return condition.negate ? !matched : matched;
    };

    const filtered = rows.filter((row) => {
      if (!query.conditions || query.conditions.length === 0) {
        return true;
      }
      if (query.logicalOperator === 'OR') {
        return query.conditions.some((condition) => matchesCondition(row, condition));
      }
      return query.conditions.every((condition) => matchesCondition(row, condition));
    });

    let paginated = filtered;
    if (query.cursor) {
      const cursorIndex = filtered.findIndex((item) => item.logicalId === query.cursor);
      paginated = cursorIndex >= 0 ? filtered.slice(cursorIndex + 1) : filtered;
    }

    return this.mapNodesBatchToApiModel(userId, paginated.slice(0, take));
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

    // 只创建今天的日期节点
    await this.prisma.node.upsert({
      where: { userId_logicalId: { userId, logicalId: calendarPath.dayId } },
      create: {
        id: uuidv4(),
        logicalId: calendarPath.dayId,
        userId,
        parentId: weekNode.id,
        content: calendarPath.dayContent,
        nodeType: 'daily',
        sortOrder: 0,
        tags: ['sys:calendar:day'],
        payload: {
          level: 'day',
          year: getYear(today),
          month: getMonth(today) + 1,
          week: getISOWeek(today),
          day: getDate(today),
          dateString: format(today, 'yyyy-MM-dd'),
        } as Prisma.InputJsonValue,
      },
      update: {
        parentId: weekNode.id,
      },
    });

    return {
      success: true,
      initialized: true,
      data: {
        yearId: yearNode.logicalId,
        weekId: weekNode.logicalId,
        dayIds: [calendarPath.dayId],
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

  // =========================================================================
  // v4.0: AI 指令节点 - 根据 DSL 查询上下文节点
  // =========================================================================

  /**
   * 根据 ID 或 logicalId 查找节点（兼容两种 ID 格式）
   * @param userId 用户 ID
   * @param nodeId 节点 ID（可能是 id 或 logicalId）
   */
  private async findNodeByAnyId(userId: string, nodeId: string) {
    // 先尝试通过 logicalId 查找
    let node = await this.prisma.node.findFirst({
      where: {
        userId,
        logicalId: nodeId,
      },
      select: {
        id: true,
        logicalId: true,
        userId: true,
        parentId: true,
        nodeRole: true,
        sortOrder: true,
        content: true,
      },
    });

    // 如果找不到，尝试通过物理 id 查找
    if (!node) {
      node = await this.prisma.node.findFirst({
        where: {
          userId,
          id: nodeId,
        },
        select: {
          id: true,
          logicalId: true,
          userId: true,
          parentId: true,
          nodeRole: true,
          sortOrder: true,
          content: true,
        },
      });
    }

    return node;
  }

  /**
   * 根据 DSL 查询上下文节点
   * @param userId 用户 ID
   * @param dsl 查询 DSL
   * @param currentNodeId 当前节点 ID（用于 relative scope）
   */
  async queryNodesByDSL(
    userId: string,
    dsl: {
      tags?: string[];
      dateRange?: string;
      scope?: 'relative' | 'global';
      ancestorId?: string;
      depth?: number;
      keywords?: string[];
    },
    currentNodeId?: string,
  ): Promise<Array<{ id: string; content: string; fields: Record<string, unknown> }>> {
    console.log('[queryNodesByDSL] Start:', { userId, dsl, currentNodeId });

    const where: any = {
      userId,
      nodeRole: 'normal',
    };

    // 1. 标签筛选
    if (dsl.tags && dsl.tags.length > 0) {
      // 查找标签 ID（tags 数组包含标签名或 ID）
      where.OR = [
        { tags: { hasSome: dsl.tags } },
        { supertagId: { in: dsl.tags } },
      ];
    }

    // 2. 时间范围筛选
    if (dsl.dateRange) {
      const dateFilter = this.parseDateRange(dsl.dateRange);
      if (dateFilter) {
        where.createdAt = dateFilter;
      }
    }

    // 3. 关键词筛选
    if (dsl.keywords && dsl.keywords.length > 0) {
      where.content = {
        contains: dsl.keywords.join(' '),
        mode: 'insensitive',
      };
    }

    // 4. 范围筛选 - 使用兼容两种 ID 格式的查找方法
    let ancestorPhysicalId: string | null = null;
    if (dsl.scope === 'relative' && currentNodeId) {
      // 获取当前节点的父节点作为范围
      const currentNode = await this.findNodeByAnyId(userId, currentNodeId);
      console.log('[queryNodesByDSL] Found current node:', currentNode);
      if (currentNode?.parentId) {
        ancestorPhysicalId = currentNode.parentId;
      }
    } else if (dsl.ancestorId) {
      const ancestorNode = await this.findNodeByAnyId(userId, dsl.ancestorId);
      console.log('[queryNodesByDSL] Found ancestor node:', ancestorNode);
      ancestorPhysicalId = ancestorNode?.id ?? null;
    }

    console.log('[queryNodesByDSL] Where clause:', JSON.stringify(where, null, 2));
    console.log('[queryNodesByDSL] Ancestor physical ID:', ancestorPhysicalId);

    // 先查询符合基本条件的节点
    const candidates = await this.prisma.node.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 100, // 限制数量
      select: {
        id: true,
        logicalId: true,
        content: true,
        fields: true,
        parentId: true,
      },
    });

    console.log('[queryNodesByDSL] Candidates found:', candidates.length);
    
    // 5. 如果有祖先限制，过滤子树内的节点
    let results = candidates;
    if (ancestorPhysicalId) {
      const subtreeIds = await this.getSubtreeIds(userId, ancestorPhysicalId, dsl.depth);
      console.log('[queryNodesByDSL] Subtree IDs count:', subtreeIds.size);
      results = candidates.filter(node => subtreeIds.has(node.id));
    }

    console.log('[queryNodesByDSL] Final results:', results.length);
    
    return results.map(node => ({
      id: node.logicalId,
      content: node.content,
      fields: (node.fields as Record<string, unknown>) ?? {},
    }));
  }

  /**
   * 解析时间范围
   */
  private parseDateRange(dateRange: string): { gte?: Date; lte?: Date } | null {
    const now = new Date();
    const today = startOfDay(now);

    switch (dateRange) {
      case 'today':
        return { gte: today };
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { gte: yesterday, lte: today };
      }
      case 'this_week': {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        return { gte: startOfWeek };
      }
      case 'last_week': {
        const endOfLastWeek = new Date(today);
        endOfLastWeek.setDate(today.getDate() - today.getDay());
        const startOfLastWeek = new Date(endOfLastWeek);
        startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
        return { gte: startOfLastWeek, lte: endOfLastWeek };
      }
      case 'this_month': {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        return { gte: startOfMonth };
      }
      case 'last_month': {
        const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        return { gte: startOfLastMonth, lte: endOfLastMonth };
      }
      default:
        return null;
    }
  }

  /**
   * 获取子树所有节点 ID
   */
  private async getSubtreeIds(userId: string, rootId: string, maxDepth?: number): Promise<Set<string>> {
    const ids = new Set<string>([rootId]);
    const queue: Array<{ id: string; depth: number }> = [{ id: rootId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      
      // 如果有深度限制且已达到，跳过
      if (maxDepth !== undefined && depth >= maxDepth) continue;
      
      const children = await this.prisma.node.findMany({
        where: { userId, parentId: id },
        select: { id: true },
      });
      
      for (const child of children) {
        if (!ids.has(child.id)) {
          ids.add(child.id);
          queue.push({ id: child.id, depth: depth + 1 });
        }
      }
    }

    return ids;
  }
}

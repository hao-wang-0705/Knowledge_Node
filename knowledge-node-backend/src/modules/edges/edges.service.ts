import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { EdgeType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StatusMachineService } from '../status-machine/status-machine.service';
import type { CreateEdgeDto, EdgeTypeDto } from './dto/edge.dto';

const BLOCKS_SOURCE_TAG_NAMES = ['卡点', 'todo'];
const BLOCKS_TARGET_TAG_NAMES = ['todo'];
const RESOLVES_SOURCE_TAG_NAMES = ['灵感'];
const RESOLVES_TARGET_TAG_NAMES = ['卡点'];

const FALLBACK_TODO_FIELD = 'todo_status';
const FALLBACK_READY = 'Ready';
const FALLBACK_LOCKED = 'Locked';
const FALLBACK_DONE = 'Done';
const FALLBACK_RESOLVED = 'Resolved';

@Injectable()
export class EdgesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statusMachine: StatusMachineService,
  ) {}

  private async getNodeWithTag(userId: string, logicalId: string) {
    const node = await this.prisma.node.findFirst({
      where: { userId, logicalId },
      select: {
        id: true,
        logicalId: true,
        supertagId: true,
        supertag: { select: { name: true } },
      },
    });
    return node;
  }

  private async getNodePhysicalId(userId: string, logicalId: string) {
    const node = await this.prisma.node.findFirst({
      where: { userId, logicalId },
      select: { id: true },
    });
    return node?.id ?? null;
  }

  private getTagName(node: { supertag?: { name: string } | null }): string | null {
    return node.supertag?.name ?? null;
  }

  /**
   * 根据当前 BLOCKS 边与前置节点状态，统一推导目标节点的状态字段（由状态机配置驱动）：
   * - 若存在未解除的前置（卡点未 Resolved 或 todo 未 Done），则置为 blocked 态（如 Locked）
   * - 若所有前置均已解除或不存在前置，则 Locked -> unblocked 态（如 Ready）
   */
  private async recomputeTodoStatusForTarget(userId: string, targetPhysicalId: string): Promise<void> {
    const targetNode = await this.prisma.node.findFirst({
      where: { id: targetPhysicalId, userId },
      select: { id: true, fields: true, supertag: { select: { name: true } } },
    });
    if (!targetNode) return;
    const tagName = targetNode.supertag?.name ?? '';
    if (tagName !== 'todo') return;

    const info = await this.statusMachine.getStatusConfig('todo');
    const fieldKey = info?.fieldKey ?? FALLBACK_TODO_FIELD;
    const doneState = info?.config.doneState ?? FALLBACK_DONE;
    const blockedState = await this.statusMachine.getBlockedState('todo').then((s) => s ?? FALLBACK_LOCKED);
    const unblockedState = await this.statusMachine.getUnblockedState('todo').then((s) => s ?? FALLBACK_READY);

    const fields = (targetNode.fields as Record<string, unknown>) ?? {};
    const currentStatus = (fields[fieldKey] as string | undefined) ?? info?.config.initial ?? FALLBACK_READY;

    const inEdges = await this.prisma.networkEdge.findMany({
      where: { targetNodeId: targetPhysicalId, edgeType: 'BLOCKS' },
      select: { sourceNodeId: true },
    });
    const blockerPhysicalIds = inEdges.map((e) => e.sourceNodeId);

    if (blockerPhysicalIds.length === 0) {
      if (currentStatus === blockedState) {
        await this.prisma.node.update({
          where: { id: targetPhysicalId },
          data: { fields: { ...fields, [fieldKey]: unblockedState } as object },
        });
      }
      return;
    }

    const blockers = await this.prisma.node.findMany({
      where: { id: { in: blockerPhysicalIds }, userId },
      select: { id: true, fields: true, supertag: { select: { name: true } } },
    });

    let hasUnresolved = false;
    for (const b of blockers) {
      const bTag = b.supertag?.name ?? '';
      const bFields = (b.fields as Record<string, unknown>) ?? {};
      const blockerFieldKey = await this.statusMachine.getStatusFieldKey(bTag);
      const blockerValue = (blockerFieldKey ? (bFields[blockerFieldKey] as string) : undefined) ?? '';
      const resolved =
        await this.statusMachine.isResolved(bTag, blockerValue) ||
        (await this.statusMachine.isDone(bTag, blockerValue));
      if (!resolved) {
        hasUnresolved = true;
        break;
      }
    }

    if (hasUnresolved) {
      if (currentStatus !== doneState && currentStatus !== blockedState) {
        await this.prisma.node.update({
          where: { id: targetPhysicalId },
          data: { fields: { ...fields, [fieldKey]: blockedState } as object },
        });
      }
    } else {
      if (currentStatus === blockedState) {
        await this.prisma.node.update({
          where: { id: targetPhysicalId },
          data: { fields: { ...fields, [fieldKey]: unblockedState } as object },
        });
      }
    }
  }

  /**
   * CONTAINS：先检查环（source 的祖先不能含 target），再删 target 的已有 CONTAINS 入边，再建 (source, target, CONTAINS)
   */
  async ensureContainsEdge(userId: string, sourceLogicalId: string, targetLogicalId: string) {
    const [source, target] = await Promise.all([
      this.getNodePhysicalId(userId, sourceLogicalId),
      this.getNodePhysicalId(userId, targetLogicalId),
    ]);
    if (!source || !target) {
      throw new NotFoundException('起点或终点节点不存在');
    }
    if (source === target) {
      throw new BadRequestException('节点不能包含自身');
    }
    // 防环：从 source 沿 CONTAINS 入边向上走，若到达 target 则形成环
    let cursor: string | null = source;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      if (cursor === target) {
        throw new BadRequestException('检测到循环引用，禁止形成环');
      }
      const inEdge: { sourceNodeId: string } | null = await this.prisma.networkEdge.findFirst({
        where: { targetNodeId: cursor, edgeType: 'CONTAINS' },
        select: { sourceNodeId: true },
      });
      cursor = inEdge?.sourceNodeId ?? null;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.networkEdge.deleteMany({
        where: { targetNodeId: target, edgeType: 'CONTAINS' },
      });
      await tx.networkEdge.upsert({
        where: {
          sourceNodeId_targetNodeId_edgeType: {
            sourceNodeId: source,
            targetNodeId: target,
            edgeType: 'CONTAINS',
          },
        },
        create: { sourceNodeId: source, targetNodeId: target, edgeType: 'CONTAINS' },
        update: {},
      });
    });
  }

  /** 移除某节点的 CONTAINS 入边（即脱离父节点） */
  async removeContainsInEdgeForTarget(userId: string, targetLogicalId: string) {
    const target = await this.getNodePhysicalId(userId, targetLogicalId);
    if (!target) throw new NotFoundException('节点不存在');
    await this.prisma.networkEdge.deleteMany({
      where: { targetNodeId: target, edgeType: 'CONTAINS' },
    });
  }

  private async assertNoCycleInEdges(
    userId: string,
    edgeType: EdgeType,
    sourcePhysicalId: string,
    targetPhysicalId: string,
  ) {
    const visited = new Set<string>();
    const stack = [targetPhysicalId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === sourcePhysicalId) {
        throw new BadRequestException('建边失败：检测到循环依赖逻辑');
      }
      if (visited.has(current)) continue;
      visited.add(current);
      const outEdges = await this.prisma.networkEdge.findMany({
        where: { sourceNodeId: current, edgeType },
        select: { targetNodeId: true },
      });
      for (const e of outEdges) {
        const targetNode = await this.prisma.node.findFirst({
          where: { id: e.targetNodeId, userId },
          select: { id: true },
        });
        if (targetNode) stack.push(e.targetNodeId);
      }
    }
  }

  private validateBlocksOrResolves(
    edgeType: EdgeTypeDto,
    sourceTagName: string | null,
    targetTagName: string | null,
  ) {
    if (edgeType === 'BLOCKS') {
      if (!BLOCKS_SOURCE_TAG_NAMES.includes(sourceTagName ?? '')) {
        throw new BadRequestException('BLOCKS 边的起点只能是 #卡点 或 #todo 节点');
      }
      if (!BLOCKS_TARGET_TAG_NAMES.includes(targetTagName ?? '')) {
        throw new BadRequestException('BLOCKS 边的终点只能是 #todo 节点');
      }
    } else if (edgeType === 'RESOLVES') {
      if (!RESOLVES_SOURCE_TAG_NAMES.includes(sourceTagName ?? '')) {
        throw new BadRequestException('RESOLVES 边的起点只能是 #灵感 节点');
      }
      if (!RESOLVES_TARGET_TAG_NAMES.includes(targetTagName ?? '')) {
        throw new BadRequestException('RESOLVES 边的终点只能是 #卡点 节点');
      }
    }
  }

  /** 同步 BLOCKS 入边：target 的“前置依赖”列表；先删后建 */
  async syncBlocksInEdgesForTarget(userId: string, targetLogicalId: string, sourceLogicalIds: string[]) {
    const target = await this.getNodePhysicalId(userId, targetLogicalId);
    if (!target) throw new NotFoundException('节点不存在');
    await this.prisma.networkEdge.deleteMany({
      where: { targetNodeId: target, edgeType: 'BLOCKS' },
    });
    for (const sourceLogicalId of sourceLogicalIds) {
      if (!sourceLogicalId) continue;
      try {
        await this.addBlocksOrResolvesEdge(userId, sourceLogicalId, targetLogicalId, 'BLOCKS');
      } catch (e) {
        if (e instanceof BadRequestException && e.message.includes('循环依赖')) throw e;
        console.warn(`[EdgesService] syncBlocks skip ${sourceLogicalId} -> ${targetLogicalId}:`, e);
      }
    }
    // BLOCKS 入边整体变更后，统一根据前置状态重算 todo_status
    await this.recomputeTodoStatusForTarget(userId, target);
  }

  /** 同步 RESOLVES 出边：source（灵感）解决的卡点列表；先删后建 */
  async syncResolvesOutEdgesForSource(userId: string, sourceLogicalId: string, targetLogicalIds: string[]) {
    const source = await this.getNodePhysicalId(userId, sourceLogicalId);
    if (!source) throw new NotFoundException('节点不存在');
    await this.prisma.networkEdge.deleteMany({
      where: { sourceNodeId: source, edgeType: 'RESOLVES' },
    });
    for (const targetLogicalId of targetLogicalIds) {
      if (!targetLogicalId) continue;
      try {
        await this.addBlocksOrResolvesEdge(userId, sourceLogicalId, targetLogicalId, 'RESOLVES');
      } catch (e) {
        if (e instanceof BadRequestException && e.message.includes('循环依赖')) throw e;
        console.warn(`[EdgesService] syncResolves skip ${sourceLogicalId} -> ${targetLogicalId}:`, e);
      }
    }
  }

  /** 同步 MENTION 出边：source 提及的 target 列表；先删后建 */
  async syncMentionOutEdgesForSource(userId: string, sourceLogicalId: string, targetLogicalIds: string[]) {
    const source = await this.getNodePhysicalId(userId, sourceLogicalId);
    if (!source) throw new NotFoundException('节点不存在');

    const uniqueTargetLogicalIds = [...new Set(targetLogicalIds.filter(Boolean))];

    await this.prisma.networkEdge.deleteMany({
      where: { sourceNodeId: source, edgeType: 'MENTION' as EdgeType },
    });

    if (uniqueTargetLogicalIds.length === 0) return;

    const targetNodes = await this.prisma.node.findMany({
      where: {
        userId,
        logicalId: { in: uniqueTargetLogicalIds },
      },
      select: { id: true, logicalId: true },
    });
    const logicalToPhysical = new Map(targetNodes.map((n) => [n.logicalId, n.id]));

    for (const targetLogicalId of uniqueTargetLogicalIds) {
      const targetPhysicalId = logicalToPhysical.get(targetLogicalId);
      if (!targetPhysicalId) continue;
      if (targetPhysicalId === source) continue;
      await this.prisma.networkEdge.upsert({
        where: {
          sourceNodeId_targetNodeId_edgeType: {
            sourceNodeId: source,
            targetNodeId: targetPhysicalId,
            edgeType: 'MENTION' as EdgeType,
          },
        },
        create: {
          sourceNodeId: source,
          targetNodeId: targetPhysicalId,
          edgeType: 'MENTION' as EdgeType,
        },
        update: {},
      });
    }
  }

  async addMentionEdge(userId: string, sourceLogicalId: string, targetLogicalId: string) {
    const [source, target] = await Promise.all([
      this.getNodePhysicalId(userId, sourceLogicalId),
      this.getNodePhysicalId(userId, targetLogicalId),
    ]);
    if (!source || !target) {
      throw new NotFoundException('起点或终点节点不存在');
    }
    if (source === target) return { ok: true };

    await this.prisma.networkEdge.upsert({
      where: {
        sourceNodeId_targetNodeId_edgeType: {
          sourceNodeId: source,
          targetNodeId: target,
          edgeType: 'MENTION' as EdgeType,
        },
      },
      create: {
        sourceNodeId: source,
        targetNodeId: target,
        edgeType: 'MENTION' as EdgeType,
      },
      update: {},
    });
    return { ok: true };
  }

  /** 查询某节点被哪些 source 通过 MENTION 提及（返回 source/target 的 logicalId） */
  async findMentionInEdgesForTarget(userId: string, targetLogicalId: string) {
    const target = await this.getNodePhysicalId(userId, targetLogicalId);
    if (!target) throw new NotFoundException('节点不存在');

    const mentionEdges = await this.prisma.networkEdge.findMany({
      where: {
        targetNodeId: target,
        edgeType: 'MENTION' as EdgeType,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        sourceNodeId: true,
        targetNodeId: true,
        createdAt: true,
      },
    });

    if (mentionEdges.length === 0) return [];

    const relatedNodeIds = [...new Set(mentionEdges.flatMap((e) => [e.sourceNodeId, e.targetNodeId]))];
    const relatedNodes = await this.prisma.node.findMany({
      where: { userId, id: { in: relatedNodeIds } },
      select: { id: true, logicalId: true },
    });
    const idToLogical = new Map(relatedNodes.map((n) => [n.id, n.logicalId]));

    return mentionEdges.map((edge) => ({
      sourceNodeId: idToLogical.get(edge.sourceNodeId) ?? edge.sourceNodeId,
      targetNodeId: idToLogical.get(edge.targetNodeId) ?? edge.targetNodeId,
      createdAt: edge.createdAt,
    }));
  }

  async addBlocksOrResolvesEdge(
    userId: string,
    sourceLogicalId: string,
    targetLogicalId: string,
    edgeType: 'BLOCKS' | 'RESOLVES',
  ) {
    const [sourceNode, targetNode] = await Promise.all([
      this.getNodeWithTag(userId, sourceLogicalId),
      this.getNodeWithTag(userId, targetLogicalId),
    ]);
    if (!sourceNode || !targetNode) {
      throw new NotFoundException('起点或终点节点不存在');
    }
    if (sourceNode.id === targetNode.id) {
      throw new BadRequestException('起点与终点不能相同');
    }

    const sourceTag = this.getTagName(sourceNode);
    const targetTag = this.getTagName(targetNode);
    this.validateBlocksOrResolves(edgeType, sourceTag, targetTag);

    await this.assertNoCycleInEdges(userId, edgeType, sourceNode.id, targetNode.id);

    await this.prisma.networkEdge.upsert({
      where: {
        sourceNodeId_targetNodeId_edgeType: {
          sourceNodeId: sourceNode.id,
          targetNodeId: targetNode.id,
          edgeType,
        },
      },
      create: {
        sourceNodeId: sourceNode.id,
        targetNodeId: targetNode.id,
        edgeType,
      },
      update: {},
    });

    // BLOCKS 边写入成功后：统一根据前置状态重算 todo_status
    if (edgeType === 'BLOCKS') {
      await this.recomputeTodoStatusForTarget(userId, targetNode.id);
    }
  }

  async create(userId: string, dto: CreateEdgeDto) {
    const { sourceNodeId, targetNodeId, edgeType } = dto;
    if (edgeType === 'CONTAINS') {
      await this.ensureContainsEdge(userId, sourceNodeId, targetNodeId);
      return { ok: true };
    }
    if (edgeType === 'BLOCKS' || edgeType === 'RESOLVES') {
      await this.addBlocksOrResolvesEdge(userId, sourceNodeId, targetNodeId, edgeType);
      return { ok: true };
    }
    if (edgeType === 'MENTION') {
      await this.addMentionEdge(userId, sourceNodeId, targetNodeId);
      return { ok: true };
    }
    throw new BadRequestException('不支持的边类型');
  }

  async findEdges(
    userId: string,
    opts: { nodeId?: string; edgeType?: EdgeTypeDto; direction?: 'in' | 'out' },
  ) {
    const { nodeId, edgeType, direction } = opts;
    if (!nodeId) {
      return [];
    }
    const physicalId = await this.getNodePhysicalId(userId, nodeId);
    if (!physicalId) return [];

    const where: Record<string, unknown> = { edgeType: edgeType ?? undefined };
    if (direction === 'in') {
      where.targetNodeId = physicalId;
    } else if (direction === 'out') {
      where.sourceNodeId = physicalId;
    } else {
      where.OR = [{ sourceNodeId: physicalId }, { targetNodeId: physicalId }];
    }

    const edges = await this.prisma.networkEdge.findMany({
      where: where as any,
      orderBy: { createdAt: 'asc' },
    });

    const nodeIds = new Set<string>();
    edges.forEach((e) => {
      nodeIds.add(e.sourceNodeId);
      nodeIds.add(e.targetNodeId);
    });
    const nodes = await this.prisma.node.findMany({
      where: { id: { in: [...nodeIds] }, userId },
      select: { id: true, logicalId: true },
    });
    const idToLogical = new Map(nodes.map((n) => [n.id, n.logicalId]));

    return edges.map((e) => ({
      id: e.id,
      sourceNodeId: idToLogical.get(e.sourceNodeId) ?? e.sourceNodeId,
      targetNodeId: idToLogical.get(e.targetNodeId) ?? e.targetNodeId,
      edgeType: e.edgeType,
      createdAt: e.createdAt,
    }));
  }

  async deleteBySourceTargetType(
    userId: string,
    sourceLogicalId: string,
    targetLogicalId: string,
    edgeType: EdgeTypeDto,
  ) {
    const [source, target] = await Promise.all([
      this.getNodePhysicalId(userId, sourceLogicalId),
      this.getNodePhysicalId(userId, targetLogicalId),
    ]);
    if (!source || !target) {
      throw new NotFoundException('起点或终点节点不存在');
    }
    await this.prisma.networkEdge.deleteMany({
      where: {
        sourceNodeId: source,
        targetNodeId: target,
        edgeType: edgeType as EdgeType,
      },
    });
    // 删除 BLOCKS 边后，重新同步目标 todo 的锁定状态
    if (edgeType === 'BLOCKS') {
      await this.recomputeTodoStatusForTarget(userId, target);
    }
    return { ok: true };
  }

  /**
   * 获取以某节点为 target 的 CONTAINS 边的 source（即“父节点”），用于读树
   */
  async getContainsParentPhysicalId(userId: string, targetPhysicalId: string): Promise<string | null> {
    const edge = await this.prisma.networkEdge.findFirst({
      where: { targetNodeId: targetPhysicalId, edgeType: 'CONTAINS' },
      select: { sourceNodeId: true },
    });
    if (!edge) return null;
    const node = await this.prisma.node.findFirst({
      where: { id: edge.sourceNodeId, userId },
      select: { id: true },
    });
    return node?.id ?? null;
  }

  /**
   * 获取以某节点为 source 的 CONTAINS 边的 target 列表（即“子节点”），用于读树；按 Node.sortOrder 排序
   */
  async getContainsChildrenPhysicalIds(userId: string, sourcePhysicalId: string): Promise<string[]> {
    const edges = await this.prisma.networkEdge.findMany({
      where: { sourceNodeId: sourcePhysicalId, edgeType: 'CONTAINS' },
      select: { targetNodeId: true },
    });
    const targetIds = edges.map((e) => e.targetNodeId);
    if (targetIds.length === 0) return [];
    const nodes = await this.prisma.node.findMany({
      where: { id: { in: targetIds }, userId },
      select: { id: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
    });
    return nodes.map((n) => n.id);
  }

  /**
   * 批量获取 CONTAINS 入边父节点（targetPhysicalId -> sourcePhysicalId），返回 logicalId
   */
  async getContainsParentLogicalIds(
    userId: string,
    targetPhysicalIds: string[],
  ): Promise<Map<string, string>> {
    if (targetPhysicalIds.length === 0) return new Map();
    const edges = await this.prisma.networkEdge.findMany({
      where: { targetNodeId: { in: targetPhysicalIds }, edgeType: 'CONTAINS' },
      select: { sourceNodeId: true, targetNodeId: true },
    });
    const sourceIds = [...new Set(edges.map((e) => e.sourceNodeId))];
    const nodes = await this.prisma.node.findMany({
      where: { id: { in: sourceIds }, userId },
      select: { id: true, logicalId: true },
    });
    const idToLogical = new Map(nodes.map((n) => [n.id, n.logicalId]));
    const result = new Map<string, string>();
    for (const e of edges) {
      const logical = idToLogical.get(e.sourceNodeId);
      if (logical) result.set(e.targetNodeId, logical);
    }
    return result;
  }

  /**
   * 批量获取 CONTAINS 出边子节点（sourcePhysicalId -> target logicalIds，已按 sortOrder）
   */
  async getContainsChildrenLogicalIds(
    userId: string,
    sourcePhysicalIds: string[],
  ): Promise<Map<string, string[]>> {
    if (sourcePhysicalIds.length === 0) return new Map();
    const edges = await this.prisma.networkEdge.findMany({
      where: { sourceNodeId: { in: sourcePhysicalIds }, edgeType: 'CONTAINS' },
      select: { sourceNodeId: true, targetNodeId: true },
    });
    const targetIds = [...new Set(edges.map((e) => e.targetNodeId))];
    const nodes = await this.prisma.node.findMany({
      where: { id: { in: targetIds }, userId },
      select: { id: true, logicalId: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
    });
    const idToLogical = new Map(nodes.map((n) => [n.id, n.logicalId]));
    const idToOrder = new Map(nodes.map((n) => [n.id, n.sortOrder]));
    const result = new Map<string, Array<{ id: string; order: number }>>();
    for (const e of edges) {
      const list = result.get(e.sourceNodeId) ?? [];
      list.push({ id: e.targetNodeId, order: idToOrder.get(e.targetNodeId) ?? 0 });
      result.set(e.sourceNodeId, list);
    }
    const out = new Map<string, string[]>();
    for (const [sourceId, pairs] of result) {
      pairs.sort((a, b) => a.order - b.order);
      out.set(
        sourceId,
        pairs.map((p) => idToLogical.get(p.id) ?? p.id),
      );
    }
    return out;
  }

  /**
   * 删除与某节点相关的所有边（节点删除时由调用方或级联触发；若用 FK cascade 则可不调）
   */
  async deleteAllEdgesForNode(physicalNodeId: string) {
    await this.prisma.networkEdge.deleteMany({
      where: {
        OR: [{ sourceNodeId: physicalNodeId }, { targetNodeId: physicalNodeId }],
      },
    });
  }
}

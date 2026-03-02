import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { CreateNodeRequest, UpdateNodeRequest } from '@/types';

type NodeApiModel = {
  id: string;
  content: string;
  type: string;
  parentId: string | null;
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

function toNodeApiModel(
  node: {
    id: string;
    content: string;
    nodeType: string;
    parentId: string | null;
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
  childrenIds: string[] = []
): NodeApiModel {
  return {
    id: node.id,
    content: node.content,
    type: node.nodeType,
    parentId: node.parentId,
    childrenIds,
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

async function resolveParentId(
  userId: string,
  originalParentId: string | null,
  userPrefix: string,
  maxRetries = 3
): Promise<string | null> {
  if (!originalParentId) return null;

  const isCalendarNode =
    originalParentId.startsWith('year-') ||
    originalParentId.startsWith('month-') ||
    originalParentId.startsWith('week-') ||
    originalParentId.startsWith('day-');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const parentExists = await prisma.node.findFirst({
      where: { id: originalParentId, userId },
      select: { id: true },
    });
    if (parentExists) return originalParentId;

    if (isCalendarNode) {
      const prefixedParentId = `${userPrefix}_${originalParentId}`;
      const prefixedExists = await prisma.node.findFirst({
        where: { id: prefixedParentId, userId },
        select: { id: true },
      });
      if (prefixedExists) return prefixedParentId;
    }

    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }

  return null;
}

async function resolveSupertagId(userId: string, supertagId?: string | null): Promise<string | null> {
  if (!supertagId) return null;
  const supertagExists = await prisma.supertag.findFirst({
    where: { id: supertagId, userId },
    select: { id: true },
  });
  return supertagExists ? supertagId : null;
}

async function getNextSortOrder(userId: string, parentId: string | null): Promise<number> {
  const maxSortOrder = await prisma.node.aggregate({
    where: { userId, parentId },
    _max: { sortOrder: true },
  });
  return (maxSortOrder._max.sortOrder ?? 0) + 1;
}

export type ListNodesOptions = {
  rootNodeId?: string;
};

/** 统一树：按 userId 查询全部节点，或按 rootNodeId 查子树 */
export async function listNodes(userId: string, options?: ListNodesOptions): Promise<NodeApiModel[]> {
  const where: Prisma.NodeWhereInput = { userId };

  if (options?.rootNodeId) {
    const subtreeIds = new Set<string>([options.rootNodeId]);
    let queue: string[] = [options.rootNodeId];
    while (queue.length > 0) {
      const children = await prisma.node.findMany({
        where: { userId, parentId: { in: queue } },
        select: { id: true },
      });
      const newIds = children.map((c) => c.id).filter((id) => !subtreeIds.has(id));
      newIds.forEach((id) => subtreeIds.add(id));
      queue = newIds;
    }
    where.id = { in: Array.from(subtreeIds) };
  }

  const nodes = await prisma.node.findMany({
    where,
    orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  const childrenMap = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const current = childrenMap.get(node.parentId) ?? [];
    current.push(node.id);
    childrenMap.set(node.parentId, current);
  }

  return nodes.map((node) => toNodeApiModel(node, childrenMap.get(node.id) ?? []));
}

export async function getNodeById(userId: string, id: string): Promise<NodeApiModel | null> {
  const node = await prisma.node.findFirst({
    where: { id, userId },
    include: { children: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!node) return null;
  return toNodeApiModel(
    node,
    node.children.map((c) => c.id)
  );
}

export async function createOrUpsertNode(userId: string, body: CreateNodeRequest): Promise<NodeApiModel> {
  const userPrefix = userId.substring(0, 8);
  const validParentId = await resolveParentId(userId, body.parentId ?? null, userPrefix);
  const validSupertagId = await resolveSupertagId(userId, body.supertagId);
  const sortOrder = body.sortOrder ?? (await getNextSortOrder(userId, validParentId));

  if (body.id) {
    const existingNode = await prisma.node.findFirst({
      where: { id: body.id, userId },
    });

    if (existingNode) {
      const updateParentId =
        body.parentId !== undefined
          ? (await resolveParentId(userId, body.parentId, userPrefix)) ?? existingNode.parentId
          : existingNode.parentId;
      const updateSupertagId =
        body.supertagId !== undefined ? await resolveSupertagId(userId, body.supertagId) : existingNode.supertagId;

      const updatedNode = await prisma.node.update({
        where: { id: body.id },
        data: {
          content: body.content ?? existingNode.content,
          parentId: updateParentId,
          nodeType: body.nodeType ?? existingNode.nodeType,
          supertagId: updateSupertagId,
          payload: body.payload ?? ((existingNode.payload as Record<string, unknown>) ?? {}),
          fields: body.fields ?? ((existingNode.fields as Record<string, unknown>) ?? {}),
          tags: body.tags ?? existingNode.tags,
          references: body.references as any ?? existingNode.references,
          sortOrder,
        },
      });
      return toNodeApiModel(updatedNode);
    }

    const idUsedByOther = await prisma.node.findUnique({
      where: { id: body.id },
      select: { id: true },
    });

    if (idUsedByOther) {
      const prefixedId = `${userPrefix}_${body.id}`;
      const existingPrefixed = await prisma.node.findFirst({
        where: { id: prefixedId, userId },
      });

      if (existingPrefixed) {
        const updateParentId =
          body.parentId !== undefined
            ? (await resolveParentId(userId, body.parentId, userPrefix)) ?? existingPrefixed.parentId
            : existingPrefixed.parentId;

        const updatedNode = await prisma.node.update({
          where: { id: prefixedId },
          data: {
            content: body.content ?? existingPrefixed.content,
            parentId: updateParentId,
            nodeType: body.nodeType ?? existingPrefixed.nodeType,
            supertagId: validSupertagId ?? existingPrefixed.supertagId,
            payload: body.payload ?? ((existingPrefixed.payload as Record<string, unknown>) ?? {}),
            fields: body.fields ?? ((existingPrefixed.fields as Record<string, unknown>) ?? {}),
            tags: body.tags ?? existingPrefixed.tags,
            references: body.references as any ?? existingPrefixed.references,
            sortOrder,
          },
        });
        return toNodeApiModel(updatedNode);
      }

      const resolvedPrefixedParent = await resolveParentId(userId, validParentId, userPrefix);
      const createdPrefixed = await prisma.node.create({
        data: {
          id: prefixedId,
          userId,
          parentId: resolvedPrefixedParent,
          content: body.content ?? '',
          nodeType: body.nodeType ?? 'text',
          supertagId: validSupertagId,
          payload: body.payload ?? {},
          fields: body.fields ?? {},
          tags: body.tags ?? [],
          references: body.references as any ?? undefined,
          sortOrder,
        },
      });
      return toNodeApiModel(createdPrefixed);
    }
  }

  const node = await prisma.node.create({
    data: {
      ...(body.id && { id: body.id }),
      userId,
      parentId: validParentId,
      content: body.content ?? '',
      nodeType: body.nodeType ?? 'text',
      supertagId: validSupertagId,
      payload: body.payload ?? {},
      fields: body.fields ?? {},
      tags: body.tags ?? [],
      references: body.references as any ?? undefined,
      sortOrder,
    },
  });

  return toNodeApiModel(node);
}

export async function updateNode(userId: string, id: string, body: UpdateNodeRequest): Promise<NodeApiModel | null> {
  const existingNode = await prisma.node.findFirst({
    where: { id, userId },
  });
  if (!existingNode) return null;

  const userPrefix = userId.substring(0, 8);
  const parentId =
    body.parentId !== undefined ? await resolveParentId(userId, body.parentId, userPrefix) : undefined;
  const supertagId =
    body.supertagId !== undefined ? await resolveSupertagId(userId, body.supertagId) : undefined;

  const node = await prisma.node.update({
    where: { id },
    data: {
      ...(body.content !== undefined && { content: body.content }),
      ...(body.parentId !== undefined && { parentId }),
      ...(body.nodeType !== undefined && { nodeType: body.nodeType }),
      ...(body.supertagId !== undefined && { supertagId }),
      ...(body.payload !== undefined && { payload: body.payload }),
      ...(body.fields !== undefined && { fields: body.fields }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      ...(body.isCollapsed !== undefined && { isCollapsed: body.isCollapsed }),
      ...(body.tags !== undefined && { tags: body.tags }),
      ...(body.references !== undefined && { references: body.references as any }),
    },
    include: {
      children: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  return toNodeApiModel(
    node,
    node.children.map((c) => c.id)
  );
}

export type DeleteNodeResult = { ok: true } | { ok: false };

export async function deleteNode(userId: string, id: string): Promise<DeleteNodeResult> {
  const existingNode = await prisma.node.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existingNode) return { ok: false };

  await prisma.node.delete({ where: { id } });
  return { ok: true };
}


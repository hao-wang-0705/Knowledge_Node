import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { CreateNodeRequest } from '@/types';

// GET /api/nodes - 获取用户所有节点
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const nodes = await prisma.node.findMany({
      where: { userId: session.user.id },
      orderBy: [
        { parentId: 'asc' },
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    // 转换为前端需要的格式
    const formattedNodes = nodes.map(node => ({
      id: node.id,
      content: node.content,
      type: node.nodeType,
      parentId: node.parentId,
      childrenIds: nodes
        .filter(n => n.parentId === node.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(n => n.id),
      isCollapsed: node.isCollapsed,
      tags: [],
      supertagId: node.supertagId,
      fields: node.fields as Record<string, any>,
      payload: node.payload as Record<string, any>,
      createdAt: node.createdAt.getTime(),
      updatedAt: node.updatedAt.getTime(),
    }));

    return NextResponse.json({
      success: true,
      data: formattedNodes,
    });
  } catch (error) {
    console.error('Error fetching nodes:', error);
    return NextResponse.json(
      { success: false, error: '获取节点失败' },
      { status: 500 }
    );
  }
}

// POST /api/nodes - 创建新节点
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    // 验证用户是否存在于数据库中（防止 session 与数据库不同步）
    const userExists = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    });

    if (!userExists) {
      console.error(`[API] User ${session.user.id} not found in database - session may be stale`);
      return NextResponse.json(
        { success: false, error: '用户会话已过期，请重新登录', code: 'SESSION_EXPIRED' },
        { status: 401 }
      );
    }

    const body: CreateNodeRequest = await req.json();

    // 用户 ID 前缀，用于日历节点等固定 ID 的转换
    const userPrefix = session.user.id.substring(0, 8);

    /**
     * 查找父节点的实际 ID（支持重试，处理日历节点前缀）
     * @param originalParentId 原始父节点 ID
     * @param maxRetries 最大重试次数
     * @returns 实际的父节点 ID 或 null
     */
    async function resolveParentId(originalParentId: string | null, maxRetries = 3): Promise<string | null> {
      if (!originalParentId) return null;
      
      // session.user.id 在此处已经通过前面的检查，确保非空
      const userId = session!.user!.id;
      
      const isCalendarNode = originalParentId.startsWith('year-') ||
        originalParentId.startsWith('month-') ||
        originalParentId.startsWith('week-') ||
        originalParentId.startsWith('day-');
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        // 首先尝试原始 ID
        const parentExists = await prisma.node.findFirst({
          where: { id: originalParentId, userId },
          select: { id: true },
        });
        
        if (parentExists) {
          return originalParentId;
        }
        
        // 如果是日历节点，尝试查找带前缀的版本
        if (isCalendarNode) {
          const prefixedParentId = `${userPrefix}_${originalParentId}`;
          const prefixedParentExists = await prisma.node.findFirst({
            where: { id: prefixedParentId, userId },
            select: { id: true },
          });
          
          if (prefixedParentExists) {
            console.log(`[API] Parent node ${originalParentId} found with prefix: ${prefixedParentId}`);
            return prefixedParentId;
          }
        }
        
        // 如果不是最后一次尝试，等待一段时间后重试
        // 这是为了处理父节点正在被并发创建的情况
        if (attempt < maxRetries) {
          const delay = 100 * (attempt + 1); // 100ms, 200ms, 300ms
          console.log(`[API] Parent node ${originalParentId} not found, retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      // 所有重试都失败
      console.warn(`[API] Parent node ${originalParentId} not found after ${maxRetries} retries, creating as root node`);
      return null;
    }

    // 验证 parentId 是否存在（如果指定了的话）
    const validParentId = await resolveParentId(body.parentId ?? null);

    // 验证 supertagId 是否存在（如果指定了的话）
    let validSupertagId: string | null = body.supertagId ?? null;
    if (validSupertagId) {
      const supertagExists = await prisma.supertag.findFirst({
        where: { id: validSupertagId },
        select: { id: true },
      });
      
      if (!supertagExists) {
        // Supertag 不存在，记录警告但继续（将 supertagId 设为 null）
        console.warn(`[API] Supertag ${validSupertagId} not found, setting to null`);
        validSupertagId = null;
      }
    }

    // 获取同级节点的最大 sortOrder
    let sortOrder = body.sortOrder ?? 0;
    if (sortOrder === 0) {
      const maxSortOrder = await prisma.node.aggregate({
        where: {
          userId: session.user.id,
          parentId: validParentId,
        },
        _max: { sortOrder: true },
      });
      sortOrder = (maxSortOrder._max.sortOrder ?? 0) + 1;
    }

    // 如果客户端提供了 ID，先检查是否已存在（upsert 语义）
    if (body.id) {
      // 检查当前用户是否已有此节点
      const existingNode = await prisma.node.findFirst({
        where: { id: body.id, userId: session.user.id },
      });
      
      if (existingNode) {
        // 节点已存在，更新它
        // 更新时也需要验证 parentId（使用重试机制）
        let updateParentId: string | null = existingNode.parentId;
        if (body.parentId !== undefined) {
          const resolvedUpdateParentId = await resolveParentId(body.parentId);
          updateParentId = resolvedUpdateParentId ?? existingNode.parentId;
        }
        
        // 更新时也需要验证 supertagId
        let updateSupertagId = body.supertagId !== undefined ? body.supertagId : existingNode.supertagId;
        if (updateSupertagId && body.supertagId !== undefined) {
          const supertagExists = await prisma.supertag.findFirst({
            where: { id: updateSupertagId },
            select: { id: true },
          });
          if (!supertagExists) {
            // Supertag 不存在，保持原有的 supertagId
            updateSupertagId = existingNode.supertagId;
          }
        }
        
        const updatedNode = await prisma.node.update({
          where: { id: body.id },
          data: {
            content: body.content ?? existingNode.content,
            parentId: updateParentId,
            nodeType: body.nodeType ?? existingNode.nodeType,
            supertagId: updateSupertagId,
            payload: body.payload ?? (existingNode.payload as Record<string, any>) ?? {},
            fields: body.fields ?? (existingNode.fields as Record<string, any>) ?? {},
            sortOrder,
          },
        });
        
        return NextResponse.json({
          success: true,
          data: {
            id: updatedNode.id,
            content: updatedNode.content,
            type: updatedNode.nodeType,
            parentId: updatedNode.parentId,
            childrenIds: [],
            isCollapsed: updatedNode.isCollapsed,
            tags: [],
            supertagId: updatedNode.supertagId,
            fields: updatedNode.fields,
            payload: updatedNode.payload,
            createdAt: updatedNode.createdAt.getTime(),
            updatedAt: updatedNode.updatedAt.getTime(),
          },
        });
      }
      
      // 检查此 ID 是否被其他用户使用（全局唯一约束）
      const idUsedByOther = await prisma.node.findUnique({
        where: { id: body.id },
        select: { id: true, userId: true },
      });
      
      if (idUsedByOther) {
        // ID 被其他用户使用，为当前用户生成带前缀的新 ID
        // 使用用户 ID 的前 8 位作为前缀确保唯一性
        const userPrefix = session.user.id.substring(0, 8);
        const newId = `${userPrefix}_${body.id}`;
        console.log(`[API] Node ID ${body.id} already used by another user, creating with new ID: ${newId}`);
        
        // 检查带前缀的 ID 是否已存在（upsert 语义）
        const prefixedNodeExists = await prisma.node.findFirst({
          where: { id: newId, userId: session.user.id },
        });
        
        if (prefixedNodeExists) {
          // 带前缀的节点已存在，更新它
          // 处理 parentId（使用重试机制）
          let updateParentId: string | null = prefixedNodeExists.parentId;
          if (body.parentId !== undefined) {
            const resolvedUpdateParentId = await resolveParentId(body.parentId);
            updateParentId = resolvedUpdateParentId ?? prefixedNodeExists.parentId;
          }
          
          const updatedNode = await prisma.node.update({
            where: { id: newId },
            data: {
              content: body.content ?? prefixedNodeExists.content,
              parentId: updateParentId,
              nodeType: body.nodeType ?? prefixedNodeExists.nodeType,
              supertagId: validSupertagId ?? prefixedNodeExists.supertagId,
              payload: body.payload ?? (prefixedNodeExists.payload as Record<string, unknown>) ?? {},
              fields: body.fields ?? (prefixedNodeExists.fields as Record<string, unknown>) ?? {},
              sortOrder,
            },
          });
          
          return NextResponse.json({
            success: true,
            data: {
              id: updatedNode.id,
              content: updatedNode.content,
              type: updatedNode.nodeType,
              parentId: updatedNode.parentId,
              childrenIds: [],
              isCollapsed: updatedNode.isCollapsed,
              tags: [],
              supertagId: updatedNode.supertagId,
              fields: updatedNode.fields,
              payload: updatedNode.payload,
              createdAt: updatedNode.createdAt.getTime(),
              updatedAt: updatedNode.updatedAt.getTime(),
            },
          });
        }
        
        // 为新创建的带前缀节点解析 parentId（使用重试机制）
        const resolvedPrefixedParentId = await resolveParentId(validParentId);
        
        const node = await prisma.node.create({
          data: {
            id: newId,
            userId: session.user.id,
            parentId: resolvedPrefixedParentId,
            content: body.content ?? '',
            nodeType: body.nodeType ?? 'text',
            supertagId: validSupertagId,
            payload: body.payload ?? {},
            fields: body.fields ?? {},
            sortOrder,
          },
        });

        return NextResponse.json({
          success: true,
          data: {
            id: node.id,
            content: node.content,
            type: node.nodeType,
            parentId: node.parentId,
            childrenIds: [],
            isCollapsed: node.isCollapsed,
            tags: [],
            supertagId: node.supertagId,
            fields: node.fields,
            payload: node.payload,
            createdAt: node.createdAt.getTime(),
            updatedAt: node.updatedAt.getTime(),
          },
        });
      }
    }

    const node = await prisma.node.create({
      data: {
        ...(body.id && { id: body.id }), // 使用客户端提供的 ID（如果有）
        userId: session.user.id,
        parentId: validParentId,
        content: body.content ?? '',
        nodeType: body.nodeType ?? 'text',
        supertagId: validSupertagId,
        payload: body.payload ?? {},
        fields: body.fields ?? {},
        sortOrder,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: node.id,
        content: node.content,
        type: node.nodeType,
        parentId: node.parentId,
        childrenIds: [],
        isCollapsed: node.isCollapsed,
        tags: [],
        supertagId: node.supertagId,
        fields: node.fields,
        payload: node.payload,
        createdAt: node.createdAt.getTime(),
        updatedAt: node.updatedAt.getTime(),
      },
    });
  } catch (error) {
    console.error('Error creating node:', error);
    return NextResponse.json(
      { success: false, error: '创建节点失败' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { CreateSupertagRequest, FieldDefinition, Supertag, TemplateNode } from '@/types';

// 合并继承字段的辅助函数
function mergeFieldDefinitionsWithInheritance(
  parentDefs: FieldDefinition[] = [],
  ownDefs: FieldDefinition[] = []
): FieldDefinition[] {
  const merged = new Map<string, FieldDefinition>();

  parentDefs.forEach((field) => {
    merged.set(field.key, { ...field, inherited: true });
  });

  ownDefs.forEach((field) => {
    merged.set(field.key, { ...field, inherited: false });
  });

  return Array.from(merged.values());
}

// 递归获取合并继承后的字段定义
async function getResolvedFieldDefinitions(
  tagId: string,
  allTags: Map<string, any>,
  visited: Set<string> = new Set()
): Promise<FieldDefinition[]> {
  const tag = allTags.get(tagId);
  if (!tag) return [];
  if (visited.has(tagId)) return tag.fieldDefinitions ?? [];
  visited.add(tagId);

  const ownDefs = (tag.fieldDefinitions ?? []) as FieldDefinition[];
  if (!tag.parentId) {
    return ownDefs.map((f) => ({ ...f, inherited: false }));
  }

  const parentDefs = await getResolvedFieldDefinitions(tag.parentId, allTags, visited);
  return mergeFieldDefinitionsWithInheritance(parentDefs, ownDefs);
}

// GET /api/supertags - 获取用户所有 Supertags（含继承解析）
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const supertags = await prisma.supertag.findMany({
      where: { userId: session.user.id },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    // 构建 Map 用于解析继承
    const tagMap = new Map(supertags.map(t => [t.id, t]));

    // 转换为前端需要的格式（含继承解析）
    const formattedSupertags = await Promise.all(
      supertags.map(async (tag) => {
        const resolvedFieldDefinitions = await getResolvedFieldDefinitions(tag.id, tagMap);
        
        return {
          id: tag.id,
          name: tag.name,
          color: tag.color,
          icon: tag.icon,
          description: tag.description,
          fieldDefinitions: tag.fieldDefinitions as unknown as FieldDefinition[],
          resolvedFieldDefinitions,
          isSystem: tag.isSystem,
          categoryId: tag.categoryId,
          order: tag.order,
          parentId: tag.parentId,
          templateContent: tag.templateContent as TemplateNode | TemplateNode[] | null,
          createdAt: tag.createdAt.getTime(),
          updatedAt: tag.updatedAt.getTime(),
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: formattedSupertags,
    });
  } catch (error) {
    console.error('Error fetching supertags:', error);
    return NextResponse.json(
      { success: false, error: '获取标签失败' },
      { status: 500 }
    );
  }
}

// POST /api/supertags - 创建新 Supertag
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

    const body: CreateSupertagRequest = await req.json();

    if (!body.name?.trim()) {
      return NextResponse.json(
        { success: false, error: '标签名称不能为空' },
        { status: 400 }
      );
    }

    // 检查是否已存在同名标签
    const existingTag = await prisma.supertag.findFirst({
      where: {
        userId: session.user.id,
        name: body.name.trim(),
      },
    });

    if (existingTag) {
      return NextResponse.json(
        { success: false, error: '已存在同名标签' },
        { status: 400 }
      );
    }

    // 如果指定了父标签，验证父标签存在
    if (body.parentId) {
      const parentTag = await prisma.supertag.findFirst({
        where: {
          id: body.parentId,
          userId: session.user.id,
        },
      });
      if (!parentTag) {
        return NextResponse.json(
          { success: false, error: '父标签不存在' },
          { status: 400 }
        );
      }
    }

    // 获取当前最大排序号
    const maxOrder = await prisma.supertag.aggregate({
      where: { userId: session.user.id },
      _max: { order: true },
    });

    const supertag = await prisma.supertag.create({
      data: {
        userId: session.user.id,
        name: body.name.trim(),
        color: body.color ?? '#6366F1',
        icon: body.icon ?? null,
        description: body.description ?? null,
        fieldDefinitions: (body.fieldDefinitions ?? []) as unknown as object,
        categoryId: body.categoryId ?? 'cat_uncategorized',
        order: (maxOrder._max.order ?? 0) + 1,
        parentId: body.parentId ?? null,
        templateContent: body.templateContent as object ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: supertag.id,
        name: supertag.name,
        color: supertag.color,
        icon: supertag.icon,
        description: supertag.description,
        fieldDefinitions: supertag.fieldDefinitions,
        isSystem: supertag.isSystem,
        categoryId: supertag.categoryId,
        order: supertag.order,
        parentId: supertag.parentId,
        templateContent: supertag.templateContent,
        createdAt: supertag.createdAt.getTime(),
        updatedAt: supertag.updatedAt.getTime(),
      },
    });
  } catch (error) {
    console.error('Error creating supertag:', error);
    return NextResponse.json(
      { success: false, error: '创建标签失败' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { UpdateSupertagRequest, FieldDefinition, TemplateNode } from '@/types';

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
  userId: string,
  visited: Set<string> = new Set()
): Promise<FieldDefinition[]> {
  const tag = await prisma.supertag.findFirst({
    where: { id: tagId, userId },
  });
  
  if (!tag) return [];
  if (visited.has(tagId)) return (tag.fieldDefinitions as unknown as FieldDefinition[]) ?? [];
  visited.add(tagId);

  const ownDefs = (tag.fieldDefinitions ?? []) as unknown as FieldDefinition[];
  if (!tag.parentId) {
    return ownDefs.map((f) => ({ ...f, inherited: false }));
  }

  const parentDefs = await getResolvedFieldDefinitions(tag.parentId, userId, visited);
  return mergeFieldDefinitionsWithInheritance(parentDefs, ownDefs);
}

// 检查是否会形成循环继承
async function wouldCreateCycle(
  tagId: string,
  newParentId: string,
  userId: string
): Promise<boolean> {
  const visited = new Set<string>();
  let currentId: string | null = newParentId;

  while (currentId) {
    if (currentId === tagId) return true;
    if (visited.has(currentId)) return false;
    visited.add(currentId);

    const foundTag: { parentId: string | null } | null = await prisma.supertag.findFirst({
      where: { id: currentId, userId },
      select: { parentId: true },
    });
    currentId = foundTag?.parentId ?? null;
  }

  return false;
}

// GET /api/supertags/[id] - 获取单个 Supertag（含继承解析）
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const supertag = await prisma.supertag.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!supertag) {
      return NextResponse.json(
        { success: false, error: '标签不存在' },
        { status: 404 }
      );
    }

    // 解析继承字段
    const resolvedFieldDefinitions = await getResolvedFieldDefinitions(
      supertag.id,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      data: {
        id: supertag.id,
        name: supertag.name,
        color: supertag.color,
        icon: supertag.icon,
        description: supertag.description,
        fieldDefinitions: supertag.fieldDefinitions as unknown as FieldDefinition[],
        resolvedFieldDefinitions,
        isSystem: supertag.isSystem,
        categoryId: supertag.categoryId,
        order: supertag.order,
        parentId: supertag.parentId,
        templateContent: supertag.templateContent as TemplateNode | TemplateNode[] | null,
        createdAt: supertag.createdAt.getTime(),
        updatedAt: supertag.updatedAt.getTime(),
      },
    });
  } catch (error) {
    console.error('Error fetching supertag:', error);
    return NextResponse.json(
      { success: false, error: '获取标签失败' },
      { status: 500 }
    );
  }
}

// PUT /api/supertags/[id] - 更新 Supertag
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body: UpdateSupertagRequest = await req.json();

    // 验证标签所有权
    const existingTag = await prisma.supertag.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingTag) {
      return NextResponse.json(
        { success: false, error: '标签不存在' },
        { status: 404 }
      );
    }

    // 如果要更新名称，检查是否与其他标签重名
    if (body.name && body.name !== existingTag.name) {
      const duplicateTag = await prisma.supertag.findFirst({
        where: {
          userId: session.user.id,
          name: body.name.trim(),
          NOT: { id },
        },
      });

      if (duplicateTag) {
        return NextResponse.json(
          { success: false, error: '已存在同名标签' },
          { status: 400 }
        );
      }
    }

    // 如果要更新父标签，检查循环继承
    if (body.parentId !== undefined && body.parentId !== existingTag.parentId) {
      if (body.parentId) {
        // 验证父标签存在
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

        // 检查循环继承
        const wouldCycle = await wouldCreateCycle(id, body.parentId, session.user.id);
        if (wouldCycle) {
          return NextResponse.json(
            { success: false, error: '不能形成循环继承' },
            { status: 400 }
          );
        }
      }
    }

    const supertag = await prisma.supertag.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.icon !== undefined && { icon: body.icon }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.fieldDefinitions !== undefined && { fieldDefinitions: body.fieldDefinitions as unknown as object }),
        ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
        ...(body.order !== undefined && { order: body.order }),
        ...(body.parentId !== undefined && { parentId: body.parentId }),
        ...(body.templateContent !== undefined && { templateContent: body.templateContent as object }),
      },
    });

    // 解析继承字段
    const resolvedFieldDefinitions = await getResolvedFieldDefinitions(
      supertag.id,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      data: {
        id: supertag.id,
        name: supertag.name,
        color: supertag.color,
        icon: supertag.icon,
        description: supertag.description,
        fieldDefinitions: supertag.fieldDefinitions,
        resolvedFieldDefinitions,
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
    console.error('Error updating supertag:', error);
    return NextResponse.json(
      { success: false, error: '更新标签失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/supertags/[id] - 删除 Supertag
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // 验证标签所有权
    const existingTag = await prisma.supertag.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingTag) {
      return NextResponse.json(
        { success: false, error: '标签不存在' },
        { status: 404 }
      );
    }

    // 不允许删除系统标签
    if (existingTag.isSystem) {
      return NextResponse.json(
        { success: false, error: '系统标签不能删除' },
        { status: 400 }
      );
    }

    // 检查是否有子标签
    const childCount = await prisma.supertag.count({
      where: {
        parentId: id,
        userId: session.user.id,
      },
    });

    if (childCount > 0) {
      return NextResponse.json(
        { success: false, error: '请先删除子标签' },
        { status: 400 }
      );
    }

    // 删除标签
    await prisma.supertag.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '标签已删除',
    });
  } catch (error) {
    console.error('Error deleting supertag:', error);
    return NextResponse.json(
      { success: false, error: '删除标签失败' },
      { status: 500 }
    );
  }
}

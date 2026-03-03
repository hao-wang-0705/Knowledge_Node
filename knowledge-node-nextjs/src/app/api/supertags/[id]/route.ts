import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { FieldDefinition, TemplateNode } from '@/types';

/**
 * GET /api/supertags/[id] - 获取单个标签详情
 * v3.4: 移除继承解析逻辑，直接返回标签数据
 * 
 * 只读接口，用于查看标签详情
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: '未登录' },
      { status: 401 }
    );
  }

  const { id } = await params;

  // 查询标签（只返回活跃状态的标签）
  const tag = await prisma.tagTemplate.findFirst({
    where: {
      id,
      status: 'active',
      // 只允许查看全局默认标签或用户订阅的标签
      OR: [
        { isGlobalDefault: true },
        {
          userLibraries: {
            some: {
              userId: session.user.id,
              isActive: true,
            },
          },
        },
      ],
    },
  });

  if (!tag) {
    return NextResponse.json(
      { success: false, error: '标签不存在或无权访问' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      icon: tag.icon,
      description: tag.description,
      fieldDefinitions: tag.fieldDefinitions as unknown as FieldDefinition[],
      // 新字段
      isGlobalDefault: tag.isGlobalDefault,
      status: tag.status,
      creatorId: tag.creatorId,
      // 向后兼容字段
      isSystem: tag.isGlobalDefault,
      order: tag.order,
      templateContent: tag.templateContent as TemplateNode | TemplateNode[] | null,
      createdAt: tag.createdAt.getTime(),
      updatedAt: tag.updatedAt.getTime(),
    },
  });
}

// 注意：PUT 和 DELETE 方法已被彻底删除
// 用户无法通过此接口修改或删除标签
// 系统预置标签由管理员通过 /api/internal/tags 管理

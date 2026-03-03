import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { FieldDefinition, TemplateNode } from '@/types';

/**
 * GET /api/supertags - 获取用户可用的所有标签（聚合查询）
 * v3.4: 移除继承解析逻辑，简化为扁平标签列表
 * 
 * 查询逻辑：
 * 1. 获取所有全局默认标签 (isGlobalDefault = true, status = 'active')
 * 2. 获取用户订阅的标签 (UserTagLibrary 关联)
 * 3. 合并去重后返回
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: '未登录' },
      { status: 401 }
    );
  }

  // 1. 获取全局默认标签
  const globalTags = await prisma.tagTemplate.findMany({
    where: {
      isGlobalDefault: true,
      status: 'active',
    },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });

  // 2. 获取用户订阅的标签（当前阶段为空，但逻辑预留）
  const userLibrary = await prisma.userTagLibrary.findMany({
    where: {
      userId: session.user.id,
      isActive: true,
    },
    include: {
      tagTemplate: true,
    },
  });

  // 3. 合并去重
  const tagMap = new Map<string, typeof globalTags[0]>();
  globalTags.forEach(tag => tagMap.set(tag.id, tag));
  userLibrary.forEach(lib => {
    if (lib.tagTemplate && !tagMap.has(lib.tagTemplate.id)) {
      tagMap.set(lib.tagTemplate.id, lib.tagTemplate);
    }
  });

  const allTags = Array.from(tagMap.values());

  // 转换为前端需要的格式（v3.4: 移除继承解析）
  const formattedTags = allTags.map((tag) => ({
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
    isSystem: tag.isGlobalDefault, // 兼容旧的 isSystem 字段
    order: tag.order,
    templateContent: tag.templateContent as TemplateNode | TemplateNode[] | null,
    createdAt: tag.createdAt.getTime(),
    updatedAt: tag.updatedAt.getTime(),
  }));

  return NextResponse.json({
    success: true,
    data: formattedTags,
  });
}

// 注意：POST 方法已被彻底删除
// 用户无法通过此接口创建标签
// 管理员创建标签请使用 /api/internal/tags

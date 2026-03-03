import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { FieldDefinition, TemplateNode } from '@/types';

/**
 * 验证管理员密钥
 */
function validateAdminKey(request: Request): boolean {
  const adminKey = request.headers.get('x-admin-key');
  const expectedKey = process.env.ADMIN_API_KEY || 'admin-secret-key';
  return adminKey === expectedKey;
}

/**
 * POST /api/internal/tags - 创建系统预置标签（管理员专用）
 * 
 * v3.4: 移除 categoryId 和 parentId 字段
 * 
 * 请求头：
 * - x-admin-key: 管理员密钥
 * 
 * 请求体：
 * - name: 标签名称（必填）
 * - color: 标签颜色
 * - icon: 标签图标
 * - description: 标签描述
 * - fieldDefinitions: 字段定义（JSON Schema）
 * - isGlobalDefault: 是否为全局默认标签（默认 true）
 * - status: 标签状态（默认 'active'）
 * - templateContent: 默认内容模版
 * - order: 排序顺序
 */
export async function POST(request: Request) {
  // 验证管理员权限
  if (!validateAdminKey(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Invalid admin key' },
      { status: 401 }
    );
  }

  const body = await request.json();

  // 验证必填字段
  if (!body.name?.trim()) {
    return NextResponse.json(
      { success: false, error: '标签名称不能为空' },
      { status: 400 }
    );
  }

  // 检查名称是否已存在
  const existing = await prisma.tagTemplate.findFirst({
    where: { name: body.name.trim() },
  });

  if (existing) {
    return NextResponse.json(
      { success: false, error: `标签名称 "${body.name}" 已存在` },
      { status: 400 }
    );
  }

  // 获取当前最大排序号
  const maxOrder = await prisma.tagTemplate.aggregate({
    _max: { order: true },
  });

  // 创建标签
  const tag = await prisma.tagTemplate.create({
    data: {
      name: body.name.trim(),
      color: body.color ?? '#6366F1',
      icon: body.icon ?? null,
      description: body.description ?? null,
      fieldDefinitions: (body.fieldDefinitions ?? []) as object,
      isGlobalDefault: body.isGlobalDefault ?? true,
      status: body.status ?? 'active',
      order: body.order ?? (maxOrder._max.order ?? 0) + 1,
      templateContent: body.templateContent as object ?? null,
      creatorId: body.creatorId ?? null,
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      icon: tag.icon,
      description: tag.description,
      fieldDefinitions: tag.fieldDefinitions as unknown as FieldDefinition[],
      isGlobalDefault: tag.isGlobalDefault,
      status: tag.status,
      creatorId: tag.creatorId,
      isSystem: tag.isGlobalDefault, // 向后兼容
      order: tag.order,
      templateContent: tag.templateContent as TemplateNode | TemplateNode[] | null,
      createdAt: tag.createdAt.getTime(),
      updatedAt: tag.updatedAt.getTime(),
    },
  });
}

/**
 * GET /api/internal/tags - 获取所有标签模版（管理员专用）
 * 
 * 返回所有标签，包括非活跃状态的标签
 */
export async function GET(request: Request) {
  // 验证管理员权限
  if (!validateAdminKey(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Invalid admin key' },
      { status: 401 }
    );
  }

  const tags = await prisma.tagTemplate.findMany({
    orderBy: [{ isGlobalDefault: 'desc' }, { order: 'asc' }, { name: 'asc' }],
  });

  const formattedTags = tags.map(tag => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    icon: tag.icon,
    description: tag.description,
    fieldDefinitions: tag.fieldDefinitions as unknown as FieldDefinition[],
    isGlobalDefault: tag.isGlobalDefault,
    status: tag.status,
    creatorId: tag.creatorId,
    isSystem: tag.isGlobalDefault,
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

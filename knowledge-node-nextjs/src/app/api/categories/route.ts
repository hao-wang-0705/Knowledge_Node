import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/categories - 获取用户所有分类
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const categories = await prisma.category.findMany({
      where: { userId: session.user.id },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    // 转换为前端需要的格式
    const formattedCategories = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      description: cat.description,
      isSystem: cat.isSystem,
      order: cat.order,
      createdAt: cat.createdAt.getTime(),
      updatedAt: cat.updatedAt.getTime(),
    }));

    return NextResponse.json({
      success: true,
      data: formattedCategories,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { success: false, error: '获取分类失败' },
      { status: 500 }
    );
  }
}

// POST /api/categories - 创建新分类
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

    const body = await req.json();

    if (!body.name?.trim()) {
      return NextResponse.json(
        { success: false, error: '分类名称不能为空' },
        { status: 400 }
      );
    }

    // 生成分类 ID
    let categoryId = body.id || `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 获取当前最大排序号
    const maxOrder = await prisma.category.aggregate({
      where: { userId: session.user.id },
      _max: { order: true },
    });

    // 如果提供了 ID，检查是否与其他用户冲突
    if (body.id) {
      // 检查当前用户是否已有此分类
      const existingCategory = await prisma.category.findFirst({
        where: { id: body.id, userId: session.user.id },
      });
      
      if (existingCategory) {
        // 分类已存在，更新它（upsert 语义）
        const updatedCategory = await prisma.category.update({
          where: { userId_id: { userId: session.user.id, id: body.id } },
          data: {
            name: body.name.trim(),
            icon: body.icon ?? existingCategory.icon,
            color: body.color ?? existingCategory.color,
            description: body.description ?? existingCategory.description,
            order: body.order ?? existingCategory.order,
          },
        });
        
        return NextResponse.json({
          success: true,
          data: {
            id: updatedCategory.id,
            name: updatedCategory.name,
            icon: updatedCategory.icon,
            color: updatedCategory.color,
            description: updatedCategory.description,
            isSystem: updatedCategory.isSystem,
            order: updatedCategory.order,
            createdAt: updatedCategory.createdAt.getTime(),
            updatedAt: updatedCategory.updatedAt.getTime(),
          },
        });
      }
      
      // 检查 ID 是否被其他用户使用
      const idUsedByOther = await prisma.category.findUnique({
        where: { id: body.id },
        select: { id: true },
      });
      
      if (idUsedByOther) {
        // ID 被其他用户使用，为当前用户生成带前缀的新 ID
        const userPrefix = session.user.id.substring(0, 8);
        categoryId = `${userPrefix}_${body.id}`;
        console.log(`[API] Category ID ${body.id} already used by another user, creating with new ID: ${categoryId}`);
        
        // 检查带前缀的 ID 是否已存在（upsert 语义）
        const prefixedCategoryExists = await prisma.category.findFirst({
          where: { id: categoryId, userId: session.user.id },
        });
        
        if (prefixedCategoryExists) {
          // 带前缀的分类已存在，更新它
          const updatedCategory = await prisma.category.update({
            where: { userId_id: { userId: session.user.id, id: categoryId } },
            data: {
              name: body.name.trim(),
              icon: body.icon ?? prefixedCategoryExists.icon,
              color: body.color ?? prefixedCategoryExists.color,
              description: body.description ?? prefixedCategoryExists.description,
              order: body.order ?? prefixedCategoryExists.order,
            },
          });
          
          return NextResponse.json({
            success: true,
            data: {
              id: updatedCategory.id,
              name: updatedCategory.name,
              icon: updatedCategory.icon,
              color: updatedCategory.color,
              description: updatedCategory.description,
              isSystem: updatedCategory.isSystem,
              order: updatedCategory.order,
              createdAt: updatedCategory.createdAt.getTime(),
              updatedAt: updatedCategory.updatedAt.getTime(),
            },
          });
        }
      }
    }

    const category = await prisma.category.create({
      data: {
        id: categoryId,
        userId: session.user.id,
        name: body.name.trim(),
        icon: body.icon ?? '📂',
        color: body.color ?? '#6B7280',
        description: body.description ?? null,
        isSystem: false,
        order: body.order ?? (maxOrder._max.order ?? 0) + 1,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
        description: category.description,
        isSystem: category.isSystem,
        order: category.order,
        createdAt: category.createdAt.getTime(),
        updatedAt: category.updatedAt.getTime(),
      },
    });
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json(
      { success: false, error: '创建分类失败' },
      { status: 500 }
    );
  }
}

// PUT /api/categories - 批量更新分类（用于排序）
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { categories } = body;

    if (!Array.isArray(categories)) {
      return NextResponse.json(
        { success: false, error: '无效的分类数据' },
        { status: 400 }
      );
    }

    // 批量更新分类
    const updates = categories.map((cat: { id: string; order?: number; name?: string; icon?: string; color?: string; description?: string }, index: number) =>
      prisma.category.update({
        where: { 
          userId_id: {
            userId: session.user.id,
            id: cat.id,
          }
        },
        data: {
          order: cat.order ?? index,
          ...(cat.name && { name: cat.name }),
          ...(cat.icon && { icon: cat.icon }),
          ...(cat.color && { color: cat.color }),
          ...(cat.description !== undefined && { description: cat.description }),
        },
      })
    );

    await prisma.$transaction(updates);

    return NextResponse.json({
      success: true,
      message: '分类更新成功',
    });
  } catch (error) {
    console.error('Error updating categories:', error);
    return NextResponse.json(
      { success: false, error: '更新分类失败' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/categories/[id] - 获取单个分类
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const category = await prisma.category.findUnique({
      where: { 
        userId_id: {
          userId: session.user.id,
          id,
        }
      },
    });

    if (!category) {
      return NextResponse.json(
        { success: false, error: '分类不存在' },
        { status: 404 }
      );
    }

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
    console.error('Error fetching category:', error);
    return NextResponse.json(
      { success: false, error: '获取分类失败' },
      { status: 500 }
    );
  }
}

// PATCH /api/categories/[id] - 更新分类
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const body = await req.json();

    // 检查分类是否存在
    const existing = await prisma.category.findUnique({
      where: { 
        userId_id: {
          userId: session.user.id,
          id,
        }
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '分类不存在' },
        { status: 404 }
      );
    }

    const category = await prisma.category.update({
      where: { 
        userId_id: {
          userId: session.user.id,
          id,
        }
      },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.icon !== undefined && { icon: body.icon }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.order !== undefined && { order: body.order }),
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
    console.error('Error updating category:', error);
    return NextResponse.json(
      { success: false, error: '更新分类失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/categories/[id] - 删除分类
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    // 检查分类是否存在
    const existing = await prisma.category.findUnique({
      where: { 
        userId_id: {
          userId: session.user.id,
          id,
        }
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '分类不存在' },
        { status: 404 }
      );
    }

    // 系统分类不允许删除
    if (existing.isSystem) {
      return NextResponse.json(
        { success: false, error: '系统分类不允许删除' },
        { status: 400 }
      );
    }

    // 将该分类下的标签移动到"未分类"
    await prisma.supertag.updateMany({
      where: {
        userId: session.user.id,
        categoryId: id,
      },
      data: {
        categoryId: 'cat_uncategorized',
      },
    });

    // 删除分类
    await prisma.category.delete({
      where: { 
        userId_id: {
          userId: session.user.id,
          id,
        }
      },
    });

    return NextResponse.json({
      success: true,
      message: '分类删除成功',
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json(
      { success: false, error: '删除分类失败' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { UpdateNodeRequest } from '@/types';
import { proxyToBackend, toProxyResponse } from '@/lib/backend-proxy';
import { processNodeAIFields, hasAIFields, getAIFieldDefinitions } from '@/services/ai';
import prisma from '@/lib/prisma';

// GET /api/nodes/[id] - 获取单个节点
export async function GET(
  _req: Request,
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

    const result = await proxyToBackend(
      session.user.id,
      `/api/nodes/${id}`,
      { method: 'GET' }
    );
    return toProxyResponse(result);
  } catch (error) {
    console.error('Error fetching node:', error);
    return NextResponse.json(
      { success: false, error: '获取节点失败' },
      { status: 500 }
    );
  }
}

// PUT /api/nodes/[id] - 更新节点
// v3.4: 支持 AI 字段自动处理（triggerOn: 'update'）
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
    const body: UpdateNodeRequest = await req.json();
    
    // v3.4: 检查是否需要处理 AI 字段（仅当 supertagId 存在且内容有变更时）
    let processedFields = body.fields || {};
    const shouldProcessAI = body.supertagId && body.content !== undefined;
    
    if (shouldProcessAI) {
      try {
        // 获取 Supertag 的字段定义
        const supertag = await prisma.tagTemplate.findUnique({
          where: { id: body.supertagId! },
          select: { fieldDefinitions: true },
        });
        
        if (supertag?.fieldDefinitions) {
          const fieldDefs = supertag.fieldDefinitions as any[];
          
          // 检查是否有需要在更新时触发的 AI 字段
          const updateTriggerFields = getAIFieldDefinitions(fieldDefs, 'update');
          
          if (updateTriggerFields.length > 0) {
            console.log(`[Nodes API] 检测到 ${updateTriggerFields.length} 个需要更新触发的 AI 字段`);
            
            // 处理 AI 字段
            const aiResult = await processNodeAIFields(
              body.content || '',
              fieldDefs,
              processedFields,
              'update'
            );
            
            if (aiResult.success) {
              processedFields = {
                ...processedFields,
                ...aiResult.fields,
              };
              console.log(`[Nodes API] AI 字段更新处理完成:`, aiResult.fields);
            } else {
              console.warn(`[Nodes API] AI 字段更新处理部分失败:`, aiResult.details);
            }
          }
        }
      } catch (aiError) {
        // AI 处理失败不应阻塞节点更新
        console.error('[Nodes API] AI 字段处理错误:', aiError);
      }
    }
    
    // 使用处理后的字段更新节点
    const requestBody = {
      ...body,
      fields: Object.keys(processedFields).length > 0 ? processedFields : body.fields,
    };
    
    const result = await proxyToBackend(
      session.user.id,
      `/api/nodes/${id}`,
      { method: 'PATCH', body: JSON.stringify(requestBody) }
    );
    return toProxyResponse(result);
  } catch (error) {
    console.error('Error updating node:', error);
    return NextResponse.json(
      { success: false, error: '更新节点失败' },
      { status: 500 }
    );
  }
}

// PATCH /api/nodes/[id] - 部分更新节点（与 PUT 相同逻辑）
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // 复用 PUT 逻辑
  return PUT(req, { params });
}

// DELETE /api/nodes/[id] - 删除节点
export async function DELETE(
  _req: Request,
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

    const result = await proxyToBackend(
      session.user.id,
      `/api/nodes/${id}`,
      { method: 'DELETE' }
    );
    if (!result.ok && result.status === 409) {
      const text = JSON.stringify(result.body || '');
      if (text.includes('不能直接删除笔记本根节点')) {
        return NextResponse.json(
          {
            success: false,
            error: '不能直接删除笔记本根节点，请通过删除笔记本操作',
            code: 'NOTEBOOK_ROOT',
          },
          { status: 409 }
        );
      }
    }
    return toProxyResponse(result);
  } catch (error) {
    console.error('Error deleting node:', error);
    return NextResponse.json(
      { success: false, error: '删除节点失败' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { CreateNodeRequest } from '@/types';
import { proxyToBackend, toProxyResponse } from '@/lib/backend-proxy';
import { processNodeAIFields, hasAIFields } from '@/services/ai';
import prisma from '@/lib/prisma';

// GET /api/nodes - 获取用户节点（ADR-005：支持 scope 树隔离）
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const { search } = new URL(req.url);
    const result = await proxyToBackend(
      session.user.id,
      `/api/nodes${search}`,
      { method: 'GET' }
    );
    return toProxyResponse(result);
  } catch (error) {
    console.error('Error fetching nodes:', error);
    return NextResponse.json(
      { success: false, error: '获取节点失败' },
      { status: 500 }
    );
  }
}

// POST /api/nodes - 创建新节点
// v3.4: 支持 AI 字段自动处理
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const body: CreateNodeRequest = await req.json();
    
    // v3.4: 检查是否需要处理 AI 字段
    let processedFields = body.fields || {};
    
    if (body.supertagId) {
      try {
        // 获取 Supertag 的字段定义
        const supertag = await prisma.tagTemplate.findUnique({
          where: { id: body.supertagId },
          select: { fieldDefinitions: true },
        });
        
        if (supertag?.fieldDefinitions) {
          const fieldDefs = supertag.fieldDefinitions as any[];
          
          // 检查是否包含 AI 字段
          if (hasAIFields(fieldDefs)) {
            console.log(`[Nodes API] 检测到 AI 字段，开始处理...`);
            
            // 处理 AI 字段（异步，不阻塞节点创建）
            const aiResult = await processNodeAIFields(
              body.content || '',
              fieldDefs,
              processedFields,
              'create'
            );
            
            if (aiResult.success) {
              // 合并 AI 计算的字段值
              processedFields = {
                ...processedFields,
                ...aiResult.fields,
              };
              console.log(`[Nodes API] AI 字段处理完成:`, aiResult.fields);
            } else {
              console.warn(`[Nodes API] AI 字段处理部分失败:`, aiResult.details);
            }
          }
        }
      } catch (aiError) {
        // AI 处理失败不应阻塞节点创建
        console.error('[Nodes API] AI 字段处理错误:', aiError);
      }
    }
    
    // 使用处理后的字段创建节点
    const requestBody = {
      ...body,
      fields: processedFields,
    };
    
    const result = await proxyToBackend(
      session.user.id,
      '/api/nodes',
      { method: 'POST', body: JSON.stringify(requestBody) }
    );
    return toProxyResponse(result);
  } catch (error) {
    console.error('Error creating node:', error);
    return NextResponse.json(
      { success: false, error: '创建节点失败' },
      { status: 500 }
    );
  }
}

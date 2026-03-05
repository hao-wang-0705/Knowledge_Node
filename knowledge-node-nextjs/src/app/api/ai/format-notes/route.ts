/**
 * AI 笔记格式化 API 端点
 * POST /api/ai/format-notes
 * 
 * 将大段非结构化文字智能格式化为树形节点结构
 * 支持 SSE 流式输出，逐个推送格式化节点
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  AIClient, 
  AIServiceError, 
  AIErrorCode, 
  createAIError,
  FORMAT_NOTES_SYSTEM_PROMPT,
  buildFormatNotesPrompt,
} from '@/services/ai';
import { StreamingJsonParser, type FormatNode } from '@/utils/format-parser';

// ============================================================================
// 类型定义
// ============================================================================

/** 请求体 */
interface FormatNotesRequest {
  /** 用户输入的文本 */
  text: string;
}

// ============================================================================
// SSE 工具函数
// ============================================================================

/**
 * 创建 SSE 事件字符串
 */
function createSSEEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * 创建 SSE 错误响应
 */
function createSSEError(code: string, message: string): string {
  return createSSEEvent('error', { code, error: message });
}

// ============================================================================
// API Handler
// ============================================================================

export async function POST(request: NextRequest) {
  const requestId = `format_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  // 验证用户身份
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(
      JSON.stringify({ success: false, error: '未登录，请先登录后再使用 AI 功能' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // 解析请求体
  let body: FormatNotesRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: '无效的请求格式' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // 验证输入
  if (!body.text?.trim()) {
    return new Response(
      JSON.stringify({ success: false, error: '请提供要格式化的文本内容' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // 创建 AI 客户端
  const client = new AIClient();
  
  // 检查服务可用性
  if (!client.isAvailable()) {
    const validation = client.getValidation();
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'AI 服务不可用',
        details: validation.errors.join('; '),
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // 构建 Prompt
  const userPrompt = buildFormatNotesPrompt({ text: body.text.trim() });
  
  // 创建流式响应
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const parser = new StreamingJsonParser();
      let nodeCount = 0;
      
      try {
        // 使用 AI 客户端的流式接口
        const aiStream = client.stream({
          prompt: userPrompt,
          systemPrompt: FORMAT_NOTES_SYSTEM_PROMPT,
          requestId,
          maxTokens: 4000,
          temperature: 0.3, // 低温度以获得更稳定的结构化输出
          stream: true,
        });
        
        // 处理流式响应
        for await (const chunk of aiStream) {
          // 将 chunk 传递给解析器
          const newNodes = parser.addChunk(chunk);
          
          // 推送新解析出的节点
          for (const node of newNodes) {
            nodeCount++;
            const sseEvent = createSSEEvent('node', node);
            controller.enqueue(encoder.encode(sseEvent));
          }
        }
        
        // 如果解析器没有得到任何节点，尝试直接解析累积内容
        if (nodeCount === 0) {
          // AI 可能返回了完整的 JSON，但格式不完全是流式的
          // 这里我们发送原文作为单个节点的兜底方案
          const fallbackNode: FormatNode = {
            tempId: '1',
            content: body.text.trim(),
            parentTempId: null,
          };
          const sseEvent = createSSEEvent('node', fallbackNode);
          controller.enqueue(encoder.encode(sseEvent));
          nodeCount = 1;
        }
        
        // 发送完成事件
        const doneEvent = createSSEEvent('done', { 
          success: true, 
          nodeCount,
          requestId,
        });
        controller.enqueue(encoder.encode(doneEvent));
        
      } catch (error) {
        console.error('[Format Notes API Error]', error);
        
        let errorMessage = '格式化失败，请重试';
        let errorCode = 'UNKNOWN_ERROR';
        
        if (error instanceof AIServiceError) {
          errorMessage = error.message;
          errorCode = error.code;
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        
        // 发送错误事件
        const errorEvent = createSSEError(errorCode, errorMessage);
        controller.enqueue(encoder.encode(errorEvent));
      } finally {
        controller.close();
      }
    },
  });
  
  // 返回 SSE 响应
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Request-Id': requestId,
    },
  });
}

// GET 请求用于健康检查
export async function GET() {
  const client = new AIClient();
  const validation = client.getValidation();
  
  return new Response(
    JSON.stringify({
      service: 'ai-format-notes',
      available: validation.valid,
      errors: validation.errors,
      timestamp: Date.now(),
    }),
    { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    }
  );
}

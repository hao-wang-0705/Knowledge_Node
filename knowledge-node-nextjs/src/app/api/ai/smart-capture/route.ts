/**
 * AI 智能捕获 API 端点
 * POST /api/ai/smart-capture
 * 
 * v3.5: 合并"文本格式化整理"与"意图及标签预测"能力
 * 在单次 AI 调用中同时完成：
 * 1. 文本降噪与格式化（树形节点拆分）
 * 2. 意图识别与标签匹配（单标签策略）
 * 3. 槽位填充（Slot Filling）
 * 
 * 支持 SSE 流式输出，逐个推送带标签的格式化节点
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  AIClient, 
  AIServiceError,
} from '@/services/ai';
import { 
  SMART_CAPTURE_SYSTEM_PROMPT,
  buildSmartCapturePrompt,
  type SmartCaptureTagSchema,
} from '@/services/ai/prompts';
import { 
  SmartCaptureParser,
  applyConfidenceThreshold,
} from '@/utils/smart-capture-parser';
import type { SmartCaptureNode } from '@/types';

// ============================================================================
// 类型定义
// ============================================================================

/** 请求体 */
interface SmartCaptureRequest {
  /** 用户输入的文本 */
  text: string;
  /** 可用的 Supertag Schema 列表 */
  supertags: SmartCaptureTagSchema[];
  /** 置信度阈值（默认 0.8） */
  confidenceThreshold?: number;
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
  return createSSEEvent('error', { code, message });
}

// ============================================================================
// API Handler
// ============================================================================

export async function POST(request: NextRequest) {
  const requestId = `smart_capture_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  // 验证用户身份
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(
      JSON.stringify({ success: false, error: '未登录，请先登录后再使用 AI 功能' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // 解析请求体
  let body: SmartCaptureRequest;
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
      JSON.stringify({ success: false, error: '请提供要处理的文本内容' }),
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
  
  // 置信度阈值
  const confidenceThreshold = body.confidenceThreshold ?? 0.8;
  
  // 构建 Prompt
  const userPrompt = buildSmartCapturePrompt({
    text: body.text.trim(),
    supertags: body.supertags || [],
  });
  
  // 创建流式响应
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const parser = new SmartCaptureParser();
      let nodeCount = 0;
      let taggedNodeCount = 0;
      
      try {
        // 使用 AI 客户端的流式接口
        const aiStream = client.stream({
          prompt: userPrompt,
          systemPrompt: SMART_CAPTURE_SYSTEM_PROMPT,
          requestId,
          maxTokens: 4000,
          temperature: 0.3, // 低温度以获得更稳定的结构化输出
          stream: true,
        });
        
        // 处理流式响应
        for await (const chunk of aiStream) {
          // 将 chunk 传递给解析器
          const newNodes = parser.addChunk(chunk);
          
          // 应用置信度阈值过滤
          const filteredNodes = applyConfidenceThreshold(newNodes, confidenceThreshold);
          
          // 推送新解析出的节点
          for (const node of filteredNodes) {
            nodeCount++;
            if (node.supertagId) {
              taggedNodeCount++;
            }
            
            const sseEvent = createSSEEvent('node', node);
            controller.enqueue(encoder.encode(sseEvent));
          }
        }
        
        // 如果解析器没有得到任何节点，提供兜底方案
        if (nodeCount === 0) {
          // AI 可能返回了完整的 JSON，但格式不完全是流式的
          // 这里我们发送原文作为单个节点的兜底方案
          const fallbackNode: SmartCaptureNode = {
            tempId: '1',
            content: body.text.trim(),
            parentTempId: null,
            supertagId: null,
            fields: {},
            confidence: 0.5,
            isAIExtracted: true,
          };
          const sseEvent = createSSEEvent('node', fallbackNode);
          controller.enqueue(encoder.encode(sseEvent));
          nodeCount = 1;
        }
        
        // 发送完成事件
        const doneEvent = createSSEEvent('done', { 
          success: true, 
          nodeCount,
          taggedNodeCount,
          requestId,
        });
        controller.enqueue(encoder.encode(doneEvent));
        
        console.log(`[Smart Capture] 完成，共 ${nodeCount} 个节点，${taggedNodeCount} 个带标签`);
        
      } catch (error) {
        console.error('[Smart Capture API Error]', error);
        
        let errorMessage = '智能捕获失败，请重试';
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
      service: 'ai-smart-capture',
      version: '3.5',
      available: validation.valid,
      errors: validation.errors,
      features: [
        'text-formatting',
        'tag-matching',
        'field-extraction',
        'streaming-output',
      ],
      timestamp: Date.now(),
    }),
    { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    }
  );
}

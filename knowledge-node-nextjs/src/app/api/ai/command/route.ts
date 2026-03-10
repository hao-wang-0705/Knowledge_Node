/**
 * AI 指令执行 API 端点
 * POST /api/ai/command
 * 
 * 处理 AI 指令节点的执行请求
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  AIClient, 
  AIServiceError, 
  AIErrorCode, 
  createAIError,
  getTemplateById,
  fillPromptVariables,
  buildFullPrompt,
} from '@/services/ai';
import type { CommandCategory } from '@/types';

// 请求体类型
interface CommandRequest {
  /** 指令 ID（用于追踪） */
  commandId?: string;
  /** 模板 ID */
  templateId?: string;
  /** 自定义 Prompt */
  prompt?: string;
  /** 上下文内容 */
  context?: string;
  /** 模型 */
  model?: string;
  /** 最大 Token 数 */
  maxTokens?: number;
  /** 是否流式输出 */
  stream?: boolean;
}

// 错误响应构造器
function errorResponse(error: AIServiceError): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        suggestion: error.suggestion,
        retryable: error.retryable,
        retryAfter: error.retryAfter,
        requestId: error.requestId,
      },
    },
    { status: error.httpStatus || 500 }
  );
}

export async function POST(request: NextRequest) {
  const requestId = `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录，请先登录后再使用 AI 功能' },
        { status: 401 }
      );
    }
    
    // 解析请求体
    const body: CommandRequest = await request.json();

    // 验证必要参数
    if (!body.prompt && !body.templateId) {
      throw createAIError(AIErrorCode.CONFIG_MISSING_PROMPT, {
        requestId,
        customMessage: '必须提供 prompt 或 templateId',
      });
    }

    // 构建最终 Prompt
    let finalPrompt: string;
    let category: CommandCategory | undefined;

    if (body.templateId) {
      // 使用模板
      const template = getTemplateById(body.templateId);
      if (!template) {
        throw createAIError(AIErrorCode.CONFIG_INVALID_MODEL, {
          requestId,
          customMessage: `模板 "${body.templateId}" 不存在`,
        });
      }
      finalPrompt = fillPromptVariables(template.prompt, {
        context: body.context || '',
      });
      category = template.category;
    } else {
      // 使用自定义 Prompt
      finalPrompt = fillPromptVariables(body.prompt!, {
        context: body.context || '',
      });
    }

    // 创建 AI 客户端
    const client = new AIClient();

    // 检查服务可用性
    if (!client.isAvailable()) {
      const validation = client.getValidation();
      throw createAIError(AIErrorCode.CONFIG_MISSING_API_KEY, {
        requestId,
        technicalDetails: validation.errors.join('; '),
      });
    }

    // 判断是否使用流式输出
    const useStream = body.stream !== false;

    if (useStream) {
      // 流式响应
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const generator = client.stream({
              prompt: finalPrompt,
              category,
              model: body.model as any,
              maxTokens: body.maxTokens,
              requestId,
            });

            let result: IteratorResult<string, any>;
            while (!(result = await generator.next()).done) {
              const chunk = result.value;
              const data = JSON.stringify({
                choices: [{ delta: { content: chunk } }],
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }

            // 发送完成信号
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            const aiError = error instanceof AIServiceError
              ? error
              : createAIError(AIErrorCode.UNKNOWN_ERROR, {
                  originalError: error instanceof Error ? error : undefined,
                  requestId,
                });

            const errorData = JSON.stringify({
              error: {
                code: aiError.code,
                message: aiError.message,
                suggestion: aiError.suggestion,
              },
            });
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
            controller.close();
          }
        },
      });

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Request-ID': requestId,
        },
      });
    } else {
      // 非流式响应
      const response = await client.complete({
        prompt: finalPrompt,
        category,
        model: body.model as any,
        maxTokens: body.maxTokens,
        requestId,
      });

      return NextResponse.json({
        success: true,
        data: {
          content: response.content,
          model: response.model,
          usage: {
            promptTokens: response.promptTokens,
            completionTokens: response.completionTokens,
            totalTokens: response.totalTokens,
          },
          finishReason: response.finishReason,
          requestId: response.requestId,
        },
      });
    }
  } catch (error) {
    console.error('[AI Command API Error]', error);

    if (error instanceof AIServiceError) {
      return errorResponse(error);
    }

    const wrappedError = createAIError(AIErrorCode.UNKNOWN_ERROR, {
      originalError: error instanceof Error ? error : undefined,
      technicalDetails: String(error),
      requestId,
    });

    return errorResponse(wrappedError);
  }
}

// GET 请求用于健康检查
export async function GET() {
  const client = new AIClient();
  const validation = client.getValidation();

  return NextResponse.json({
    service: 'ai-command',
    available: validation.valid,
    errors: validation.errors,
    timestamp: Date.now(),
  });
}

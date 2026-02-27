/**
 * AI 智能捕获 API 端点
 * POST /api/ai/capture
 * 
 * 处理多模态输入（文本、图片、语音），进行智能结构化
 * 自动匹配 Supertag 并提取字段值
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  AIClient, 
  AIServiceError, 
  AIErrorCode, 
  createAIError,
  // 从统一模块导入 Prompt 相关
  CAPTURE_SYSTEM_PROMPT,
  buildCapturePrompt,
  parseCaptureResponse,
  type SupertagSchema,
} from '@/services/ai';

// ============================================================================
// 类型定义
// ============================================================================

/** 图片数据 */
interface ImageData {
  base64: string;
  name: string;
}

/** 请求体 */
interface CaptureRequest {
  /** 文本输入 */
  text?: string;
  /** 图片列表 */
  images?: ImageData[];
  /** 语音转写文本 */
  voiceTranscription?: string;
  /** 用户手动指定的标签 ID */
  manualTagId?: string;
  /** 可用的 Supertag Schema 列表 */
  supertags: SupertagSchema[];
}

// ============================================================================
// 错误响应工具
// ============================================================================

function createErrorResponse(error: AIServiceError): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        suggestion: error.suggestion,
        retryable: error.retryable,
        requestId: error.requestId,
      },
    },
    { status: error.httpStatus || 500 }
  );
}

// ============================================================================
// API Handler
// ============================================================================

export async function POST(request: NextRequest) {
  const requestId = `capture_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
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
    const body: CaptureRequest = await request.json();
    
    // 验证输入
    const hasInput = body.text?.trim() || body.voiceTranscription?.trim() || (body.images && body.images.length > 0);
    if (!hasInput) {
      throw createAIError(AIErrorCode.CONFIG_MISSING_PROMPT, {
        requestId,
        customMessage: '请提供要处理的内容',
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
    
    // 使用统一模块构建 Prompt
    const userPrompt = buildCapturePrompt({
      text: body.text,
      imageCount: body.images?.length,
      voiceTranscription: body.voiceTranscription,
      manualTagId: body.manualTagId,
      supertags: body.supertags,
    });
    
    // 调用 AI
    const response = await client.complete({
      prompt: userPrompt,
      systemPrompt: CAPTURE_SYSTEM_PROMPT,
      requestId,
      maxTokens: 2000,
      temperature: 0.3, // 降低温度以获得更稳定的结构化输出
    });
    
    // 使用统一模块解析响应
    const structured = parseCaptureResponse(response.content);
    
    // 验证标签 ID 是否有效
    if (structured.supertagId) {
      const validTagIds = body.supertags.map((t) => t.id);
      if (!validTagIds.includes(structured.supertagId)) {
        console.warn(`[AI Capture] Invalid tag ID returned: ${structured.supertagId}`);
        structured.supertagId = null;
      }
    }
    
    // 如果用户手动指定了标签，强制使用
    if (body.manualTagId) {
      const validTagIds = body.supertags.map((t) => t.id);
      if (validTagIds.includes(body.manualTagId)) {
        structured.supertagId = body.manualTagId;
      }
    }
    
    return NextResponse.json({
      success: true,
      data: structured,
      meta: {
        model: response.model,
        usage: {
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
          totalTokens: response.totalTokens,
        },
        requestId: response.requestId,
      },
    });
    
  } catch (error) {
    console.error('[AI Capture API Error]', error);
    
    if (error instanceof AIServiceError) {
      return createErrorResponse(error);
    }
    
    const wrappedError = createAIError(AIErrorCode.UNKNOWN_ERROR, {
      originalError: error instanceof Error ? error : undefined,
      technicalDetails: String(error),
      requestId,
    });
    
    return createErrorResponse(wrappedError);
  }
}

// GET 请求用于健康检查
export async function GET() {
  const client = new AIClient();
  const validation = client.getValidation();
  
  return NextResponse.json({
    service: 'ai-capture',
    available: validation.valid,
    errors: validation.errors,
    timestamp: Date.now(),
  });
}

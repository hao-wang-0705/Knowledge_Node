/**
 * 语音转写 API 端点
 * POST /api/ai/transcribe
 * 
 * 使用 Whisper 或其他 ASR 服务将语音转换为文本
 * 通过统一的 AI 模块进行封装
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  AIServiceError, 
  AIErrorCode, 
  createAIError,
  transcribeAudio,
  isTranscribeAvailable,
} from '@/services/ai';

// ============================================================================
// 类型定义
// ============================================================================

interface TranscribeRequest {
  /** 音频数据 (base64 编码) */
  audio: string;
  /** 音频格式 (如 webm, wav, mp3) */
  format?: string;
  /** 语言提示 (如 zh, en) */
  language?: string;
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
  const requestId = `transcribe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录，请先登录后再使用语音转写功能' },
        { status: 401 }
      );
    }
    
    // 解析请求体
    const body: TranscribeRequest = await request.json();
    
    // 验证输入
    if (!body.audio) {
      throw createAIError(AIErrorCode.CONFIG_MISSING_PROMPT, {
        requestId,
        customMessage: '请提供音频数据',
      });
    }
    
    // 使用统一的 AI 模块进行语音转写
    const result = await transcribeAudio({
      audio: body.audio,
      format: body.format,
      language: body.language,
      requestId,
    });
    
    return NextResponse.json({
      success: true,
      data: {
        text: result.text,
        language: result.language,
      },
      meta: {
        requestId: result.requestId,
      },
    });
    
  } catch (error) {
    console.error('[Transcribe API Error]', error);
    
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
  const available = isTranscribeAvailable();
  
  return NextResponse.json({
    service: 'ai-transcribe',
    available,
    timestamp: Date.now(),
  });
}

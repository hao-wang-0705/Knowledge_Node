/**
 * AI 服务状态检查 API
 * GET /api/ai/status
 * 
 * 返回 AI 服务的配置状态和可用性信息
 */

import { NextResponse } from 'next/server';
import { 
  AIClient, 
  getConfigDescription,
  loadAIConfig,
  MODEL_TOKEN_LIMITS,
} from '@/services/ai';

export async function GET() {
  const config = loadAIConfig();
  const client = new AIClient();
  const validation = client.getValidation();

  // 构建响应（隐藏敏感信息）
  const response = {
    status: validation.valid ? 'available' : 'unavailable',
    available: validation.valid,
    errors: validation.errors,
    configuration: {
      description: getConfigDescription(config),
      provider: config?.provider || null,
      defaultModel: config?.defaultModel || null,
      streamingEnabled: config?.enableStreaming ?? false,
      timeout: config?.timeout || null,
      maxRetries: config?.maxRetries || null,
    },
    supportedModels: Object.keys(MODEL_TOKEN_LIMITS),
    timestamp: Date.now(),
    version: '1.0.0',
  };

  // 如果服务不可用，返回 503 状态码
  if (!validation.valid) {
    return NextResponse.json(response, { status: 503 });
  }

  return NextResponse.json(response);
}

/**
 * AI 服务连通性测试 API
 * GET /api/ai/test - 测试 AI 服务是否正常连接
 */

import { NextResponse } from 'next/server';
import { 
  AIClient, 
  loadAIConfig,
  getConfigDescription,
} from '@/services/ai';

export async function GET() {
  const startTime = Date.now();
  const config = loadAIConfig();
  
  // 检查配置
  if (!config) {
    return NextResponse.json({
      success: false,
      error: '未配置 AI 服务',
      timestamp: Date.now(),
    }, { status: 503 });
  }

  try {
    const client = new AIClient();
    
    // 发送简单测试请求
    const response = await client.complete({
      prompt: '请回复"连接成功"四个字',
      systemPrompt: '你是一个简单的测试助手，只需按要求回复即可。',
      maxTokens: 50,
      temperature: 0,
      timeout: 30000,
    });

    const latency = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: '✅ AI 服务连接成功',
      response: response.content,
      configuration: {
        provider: config.provider,
        model: config.defaultModel,
        description: getConfigDescription(config),
      },
      metrics: {
        latency: `${latency}ms`,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        totalTokens: response.totalTokens,
      },
      timestamp: Date.now(),
    });

  } catch (error) {
    const latency = Date.now() - startTime;
    
    console.error('[AI Test] Connection failed:', error);

    // 提取更详细的错误信息
    let errorMessage = '连接失败';
    let technicalDetails = undefined;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      if ('technicalDetails' in error) {
        technicalDetails = (error as any).technicalDetails;
      }
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
      technicalDetails,
      configuration: {
        provider: config.provider,
        model: config.defaultModel,
        description: getConfigDescription(config),
      },
      metrics: {
        latency: `${latency}ms`,
      },
      timestamp: Date.now(),
    }, { status: 500 });
  }
}

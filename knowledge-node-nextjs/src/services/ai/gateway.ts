/**
 * AI 网关层
 * 统一的 AI 请求入口，提供日志、限流、重试等能力
 * 
 * 所有 AI 请求应通过此网关层进行，而非直接调用 AIClient
 */

import { AIClient, AIRequestParams, AIResponse, TranscribeParams, TranscribeResponse, transcribeAudio as clientTranscribe } from './client';
import { AIServiceError, createAIError, AIErrorCode } from './errors';

// ============================================================================
// 网关配置
// ============================================================================

export interface GatewayConfig {
  /** 是否启用日志 */
  enableLogging: boolean;
  /** 是否启用限流 */
  enableRateLimit: boolean;
  /** 每分钟最大请求数 */
  maxRequestsPerMinute: number;
  /** 重试次数 */
  maxRetries: number;
  /** 重试延迟(ms) */
  retryDelay: number;
}

const defaultConfig: GatewayConfig = {
  enableLogging: process.env.NODE_ENV === 'development',
  enableRateLimit: true,
  maxRequestsPerMinute: 60,
  maxRetries: 2,
  retryDelay: 1000,
};

// ============================================================================
// 请求追踪
// ============================================================================

export interface RequestMetrics {
  requestId: string;
  type: 'complete' | 'stream' | 'transcribe' | 'schema';
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

const requestHistory: RequestMetrics[] = [];
const MAX_HISTORY_SIZE = 100;

// ============================================================================
// 限流器
// ============================================================================

class RateLimiter {
  private requests: number[] = [];
  private windowMs: number = 60000; // 1 分钟窗口

  constructor(private maxRequests: number) {}

  canProceed(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.windowMs);
    return this.requests.length < this.maxRequests;
  }

  record(): void {
    this.requests.push(Date.now());
  }

  getRemaining(): number {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.windowMs);
    return Math.max(0, this.maxRequests - this.requests.length);
  }

  reset(): void {
    this.requests = [];
  }
}

// ============================================================================
// AI 网关类
// ============================================================================

export class AIGateway {
  private client: AIClient;
  private config: GatewayConfig;
  private rateLimiter: RateLimiter;

  constructor(config?: Partial<GatewayConfig>) {
    this.config = { ...defaultConfig, ...config };
    this.client = new AIClient();
    this.rateLimiter = new RateLimiter(this.config.maxRequestsPerMinute);
  }

  /**
   * 生成请求 ID
   */
  private generateRequestId(prefix: string = 'gw'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * 记录日志
   */
  private log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>): void {
    if (!this.config.enableLogging) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[AI Gateway ${timestamp}]`;
    
    switch (level) {
      case 'info':
        console.log(prefix, message, data || '');
        break;
      case 'warn':
        console.warn(prefix, message, data || '');
        break;
      case 'error':
        console.error(prefix, message, data || '');
        break;
    }
  }

  /**
   * 记录请求指标
   */
  private recordMetrics(metrics: RequestMetrics): void {
    requestHistory.push(metrics);
    if (requestHistory.length > MAX_HISTORY_SIZE) {
      requestHistory.shift();
    }
  }

  /**
   * 检查限流
   */
  private checkRateLimit(): void {
    if (!this.config.enableRateLimit) return;
    
    if (!this.rateLimiter.canProceed()) {
      throw createAIError(AIErrorCode.API_RATE_LIMITED, {
        customMessage: `请求过于频繁，请稍后再试。剩余配额: ${this.rateLimiter.getRemaining()}`,
      });
    }
  }

  /**
   * 带重试的执行
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    requestId: string
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          this.log('info', `重试请求 (${attempt}/${this.config.maxRetries})`, { requestId });
          await this.delay(this.config.retryDelay * attempt);
        }
        
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // 不可重试的错误直接抛出
        if (error instanceof AIServiceError && !error.retryable) {
          throw error;
        }
        
        this.log('warn', `请求失败`, { requestId, attempt, error: lastError.message });
      }
    }
    
    throw lastError;
  }

  /**
   * 延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean {
    return this.client.isAvailable();
  }

  /**
   * 获取配置验证结果
   */
  getValidation(): { valid: boolean; errors: string[] } {
    return this.client.getValidation();
  }

  /**
   * 统一的 AI 请求入口 (非流式)
   */
  async complete(params: AIRequestParams): Promise<AIResponse> {
    const requestId = params.requestId || this.generateRequestId('complete');
    const startTime = Date.now();
    
    const metrics: RequestMetrics = {
      requestId,
      type: 'complete',
      startTime,
      success: false,
    };

    try {
      // 检查限流
      this.checkRateLimit();
      this.rateLimiter.record();
      
      this.log('info', '开始 AI 请求', {
        requestId,
        promptLength: params.prompt.length,
        model: params.model,
        category: params.category,
      });

      // 执行请求（带重试）
      const response = await this.executeWithRetry(
        () => this.client.complete({ ...params, requestId }),
        requestId
      );

      // 记录成功指标
      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - startTime;
      metrics.success = true;
      metrics.tokenUsage = {
        prompt: response.promptTokens || 0,
        completion: response.completionTokens || 0,
        total: response.totalTokens || 0,
      };

      this.log('info', 'AI 请求成功', {
        requestId,
        duration: metrics.duration,
        tokens: metrics.tokenUsage,
        finishReason: response.finishReason,
      });

      this.recordMetrics(metrics);
      return response;

    } catch (error) {
      // 记录失败指标
      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - startTime;
      metrics.success = false;
      metrics.error = error instanceof Error ? error.message : String(error);

      this.log('error', 'AI 请求失败', {
        requestId,
        duration: metrics.duration,
        error: metrics.error,
      });

      this.recordMetrics(metrics);
      throw error;
    }
  }

  /**
   * 流式请求
   */
  async *stream(params: AIRequestParams): AsyncGenerator<string, AIResponse, undefined> {
    const requestId = params.requestId || this.generateRequestId('stream');
    const startTime = Date.now();
    
    // 检查限流
    this.checkRateLimit();
    this.rateLimiter.record();
    
    this.log('info', '开始流式 AI 请求', { 
      requestId,
      promptLength: params.prompt.length,
    });

    const metrics: RequestMetrics = {
      requestId,
      type: 'stream',
      startTime,
      success: false,
    };

    try {
      const generator = this.client.stream({ ...params, requestId });
      let result: IteratorResult<string, AIResponse>;
      
      while (!(result = await generator.next()).done) {
        yield result.value;
      }

      // 流完成
      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - startTime;
      metrics.success = true;

      this.log('info', '流式请求完成', {
        requestId,
        duration: metrics.duration,
      });

      this.recordMetrics(metrics);
      return result.value;

    } catch (error) {
      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - startTime;
      metrics.success = false;
      metrics.error = error instanceof Error ? error.message : String(error);

      this.log('error', '流式请求失败', {
        requestId,
        duration: metrics.duration,
        error: metrics.error,
      });

      this.recordMetrics(metrics);
      throw error;
    }
  }

  /**
   * 语音转写
   */
  async transcribe(params: TranscribeParams): Promise<TranscribeResponse> {
    const requestId = params.requestId || this.generateRequestId('transcribe');
    const startTime = Date.now();

    const metrics: RequestMetrics = {
      requestId,
      type: 'transcribe',
      startTime,
      success: false,
    };

    try {
      // 检查限流
      this.checkRateLimit();
      this.rateLimiter.record();

      this.log('info', '开始语音转写', {
        requestId,
        format: params.format,
        language: params.language,
      });

      const response = await this.executeWithRetry(
        () => clientTranscribe({ ...params, requestId }),
        requestId
      );

      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - startTime;
      metrics.success = true;

      this.log('info', '语音转写成功', {
        requestId,
        duration: metrics.duration,
        textLength: response.text.length,
      });

      this.recordMetrics(metrics);
      return response;

    } catch (error) {
      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - startTime;
      metrics.success = false;
      metrics.error = error instanceof Error ? error.message : String(error);

      this.log('error', '语音转写失败', {
        requestId,
        duration: metrics.duration,
        error: metrics.error,
      });

      this.recordMetrics(metrics);
      throw error;
    }
  }

  /**
   * 检查服务状态
   */
  getStatus(): {
    available: boolean;
    errors: string[];
    rateLimitRemaining: number;
    recentRequests: number;
  } {
    const validation = this.client.getValidation();
    return {
      available: validation.valid,
      errors: validation.errors,
      rateLimitRemaining: this.rateLimiter.getRemaining(),
      recentRequests: requestHistory.filter(r => 
        Date.now() - r.startTime < 60000
      ).length,
    };
  }

  /**
   * 获取请求统计
   */
  getMetrics(): {
    totalRequests: number;
    successRate: number;
    averageDuration: number;
    totalTokens: number;
    byType: Record<string, number>;
  } {
    const completed = requestHistory.filter(r => r.endTime);
    const successful = completed.filter(r => r.success);
    
    const byType: Record<string, number> = {};
    requestHistory.forEach(r => {
      byType[r.type] = (byType[r.type] || 0) + 1;
    });

    return {
      totalRequests: requestHistory.length,
      successRate: completed.length > 0 
        ? Math.round((successful.length / completed.length) * 100 * 100) / 100
        : 0,
      averageDuration: completed.length > 0
        ? Math.round(completed.reduce((sum, r) => sum + (r.duration || 0), 0) / completed.length)
        : 0,
      totalTokens: requestHistory.reduce(
        (sum, r) => sum + (r.tokenUsage?.total || 0), 
        0
      ),
      byType,
    };
  }

  /**
   * 重置限流器（用于测试）
   */
  resetRateLimiter(): void {
    this.rateLimiter.reset();
  }
}

// ============================================================================
// 单例实例
// ============================================================================

let defaultGateway: AIGateway | null = null;

/**
 * 获取默认 AI 网关实例
 */
export function getAIGateway(): AIGateway {
  if (!defaultGateway) {
    defaultGateway = new AIGateway();
  }
  return defaultGateway;
}

/**
 * 重置默认网关（用于测试或重新配置）
 */
export function resetAIGateway(): void {
  defaultGateway = null;
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 通过网关执行 AI 请求 (非流式)
 */
export async function gatewayComplete(params: AIRequestParams): Promise<AIResponse> {
  return getAIGateway().complete(params);
}

/**
 * 通过网关执行流式请求
 */
export function gatewayStream(
  params: AIRequestParams
): AsyncGenerator<string, AIResponse, undefined> {
  return getAIGateway().stream(params);
}

/**
 * 通过网关执行语音转写
 */
export async function gatewayTranscribe(params: TranscribeParams): Promise<TranscribeResponse> {
  return getAIGateway().transcribe(params);
}

/**
 * 检查 AI 网关是否可用
 */
export function isGatewayAvailable(): boolean {
  return getAIGateway().isAvailable();
}

/**
 * 获取网关状态
 */
export function getGatewayStatus() {
  return getAIGateway().getStatus();
}

/**
 * 获取网关指标
 */
export function getGatewayMetrics() {
  return getAIGateway().getMetrics();
}

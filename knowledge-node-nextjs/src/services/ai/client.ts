/**
 * AI 服务核心客户端
 * 提供统一的 AI API 调用接口，支持多种提供商
 */

import { 
  AIServiceError, 
  AIErrorCode, 
  createAIError, 
  errorFromHttpStatus, 
  wrapError 
} from './errors';
import { loadAIConfig, validateConfig, type AIServiceConfig, type AIModel } from './config';
import { buildFullPrompt, type PromptVariables, getModelTokenLimit } from './prompts';
import type { CommandTemplate } from '@/types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * AI 请求参数
 */
export interface AIRequestParams {
  /** 用户提示 */
  prompt: string;
  /** 系统提示（可选） */
  systemPrompt?: string;
  /** 模板变量 */
  variables?: PromptVariables;
  /** 指定模型（覆盖默认） */
  model?: AIModel;
  /** 最大输出 Token 数 */
  maxTokens?: number;
  /** 温度参数 (0-2) */
  temperature?: number;
  /** 是否使用流式输出 */
  stream?: boolean;
  /** 模板分类（用于选择系统提示） */
  category?: CommandTemplate['category'];
  /** 请求 ID（用于追踪） */
  requestId?: string;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 取消信号 */
  abortSignal?: AbortSignal;
}

/**
 * AI 响应结果
 */
export interface AIResponse {
  /** 生成的内容 */
  content: string;
  /** 使用的模型 */
  model: string;
  /** 输入 Token 数 */
  promptTokens?: number;
  /** 输出 Token 数 */
  completionTokens?: number;
  /** 总 Token 数 */
  totalTokens?: number;
  /** 完成原因 */
  finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls';
  /** 请求 ID */
  requestId?: string;
}

/**
 * 流式响应回调
 */
export interface StreamCallbacks {
  /** 收到新内容片段 */
  onChunk?: (chunk: string, accumulated: string) => void;
  /** 流完成 */
  onComplete?: (response: AIResponse) => void;
  /** 发生错误 */
  onError?: (error: AIServiceError) => void;
}

// ============================================================================
// AI 客户端类
// ============================================================================

/**
 * AI 服务客户端
 * 
 * 使用方法：
 * ```typescript
 * const client = new AIClient();
 * const response = await client.complete({
 *   prompt: '帮我总结这段内容',
 *   variables: { context: '...' }
 * });
 * ```
 */
export class AIClient {
  private config: AIServiceConfig | null;
  private initialized: boolean = false;

  constructor(customConfig?: Partial<AIServiceConfig>) {
    // 加载配置
    const baseConfig = loadAIConfig();
    
    if (customConfig && baseConfig) {
      this.config = { ...baseConfig, ...customConfig };
    } else if (customConfig) {
      // 仅使用自定义配置
      this.config = customConfig as AIServiceConfig;
    } else {
      this.config = baseConfig;
    }

    this.initialized = true;
  }

  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean {
    const validation = validateConfig(this.config);
    return validation.valid;
  }

  /**
   * 获取配置验证结果
   */
  getValidation(): { valid: boolean; errors: string[] } {
    return validateConfig(this.config);
  }

  /**
   * 确保配置有效，否则抛出错误
   */
  private ensureConfigured(): AIServiceConfig {
    if (!this.config) {
      throw createAIError(AIErrorCode.CONFIG_MISSING_API_KEY, {
        technicalDetails: '未找到任何 AI API 配置',
      });
    }

    if (!this.config.apiKey) {
      throw createAIError(AIErrorCode.CONFIG_MISSING_API_KEY);
    }

    if (!this.config.apiUrl) {
      throw createAIError(AIErrorCode.CONFIG_MISSING_API_URL);
    }

    return this.config;
  }

  /**
   * 生成请求 ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * 构建 API 请求 URL
   */
  private buildUrl(config: AIServiceConfig, endpoint: string = '/chat/completions', stream: boolean = false): string {
    const baseUrl = config.apiUrl.replace(/\/$/, '');
    
    // Gemini 使用不同的 URL 格式
    if (config.provider === 'gemini') {
      const model = config.defaultModel;
      // 流式使用 streamGenerateContent，非流式使用 generateContent
      const action = stream ? 'streamGenerateContent' : 'generateContent';
      const altParam = stream ? '&alt=sse' : '';
      return `${baseUrl}/models/${model}:${action}?key=${config.apiKey}${altParam}`;
    }
    
    return `${baseUrl}${endpoint}`;
  }

  /**
   * 构建请求头
   */
  private buildHeaders(config: AIServiceConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 根据提供商设置认证头
    switch (config.provider) {
      case 'openai':
      case 'venus':
      case 'custom':
        headers['Authorization'] = `Bearer ${config.apiKey}`;
        break;
      case 'anthropic':
        headers['x-api-key'] = config.apiKey;
        headers['anthropic-version'] = '2024-01-01';
        break;
      case 'gemini':
        // Gemini 使用 URL 参数传递 API key，不需要额外 header
        break;
    }

    return headers;
  }

  /**
   * 构建请求体
   */
  private buildRequestBody(
    params: AIRequestParams,
    config: AIServiceConfig
  ): Record<string, unknown> {
    const { system, user } = buildFullPrompt({
      systemPrompt: params.systemPrompt,
      userPrompt: params.prompt,
      variables: params.variables,
      category: params.category,
    });

    const model = params.model || config.defaultModel;
    const maxTokens = params.maxTokens || Math.min(4000, getModelTokenLimit(model));

    // Gemini 格式
    if (config.provider === 'gemini') {
      return {
        contents: [
          {
            parts: [
              { text: system ? `${system}\n\n${user}` : user }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: params.temperature ?? 0.7,
        },
      };
    }

    // OpenAI/Venus 格式
    if (config.provider === 'openai' || config.provider === 'venus' || config.provider === 'custom') {
      return {
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: maxTokens,
        temperature: params.temperature ?? 0.7,
        stream: params.stream ?? config.enableStreaming,
      };
    }

    // Anthropic 格式
    if (config.provider === 'anthropic') {
      return {
        model,
        system,
        messages: [{ role: 'user', content: user }],
        max_tokens: maxTokens,
        temperature: params.temperature ?? 0.7,
        stream: params.stream ?? config.enableStreaming,
      };
    }

    // 默认 OpenAI 格式
    return {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens,
      temperature: params.temperature ?? 0.7,
      stream: params.stream ?? config.enableStreaming,
    };
  }

  /**
   * 执行非流式请求
   */
  async complete(params: AIRequestParams): Promise<AIResponse> {
    const config = this.ensureConfigured();
    const requestId = params.requestId || this.generateRequestId();

    // 验证 prompt
    if (!params.prompt || params.prompt.trim().length === 0) {
      throw createAIError(AIErrorCode.CONFIG_MISSING_PROMPT, { requestId });
    }

    const url = this.buildUrl(config, '/chat/completions', false);
    const headers = this.buildHeaders(config);
    const body = this.buildRequestBody({ ...params, stream: false }, config);

    const timeout = params.timeout || config.timeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: params.abortSignal || controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw errorFromHttpStatus(response.status, errorBody, requestId);
      }

      const data = await response.json();

      // 解析响应
      const content = this.extractContent(data, config.provider);
      
      if (!content) {
        throw createAIError(AIErrorCode.EXECUTION_EMPTY_RESPONSE, {
          requestId,
          technicalDetails: JSON.stringify(data),
        });
      }

      return {
        content,
        model: data.model || (params.model || config.defaultModel),
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
        finishReason: data.choices?.[0]?.finish_reason,
        requestId,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof AIServiceError) {
        throw error;
      }

      // 检测超时
      if (error instanceof Error && error.name === 'AbortError') {
        throw createAIError(AIErrorCode.NETWORK_TIMEOUT, {
          originalError: error,
          requestId,
        });
      }

      throw wrapError(error, requestId);
    }
  }

  /**
   * 执行流式请求
   */
  async *stream(params: AIRequestParams): AsyncGenerator<string, AIResponse, undefined> {
    const config = this.ensureConfigured();
    const requestId = params.requestId || this.generateRequestId();

    // 验证 prompt
    if (!params.prompt || params.prompt.trim().length === 0) {
      throw createAIError(AIErrorCode.CONFIG_MISSING_PROMPT, { requestId });
    }

    const url = this.buildUrl(config, '/chat/completions', true);
    const headers = this.buildHeaders(config);
    const body = this.buildRequestBody({ ...params, stream: true }, config);

    const timeout = params.timeout || config.timeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: params.abortSignal || controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw errorFromHttpStatus(response.status, errorBody, requestId);
      }

      if (!response.body) {
        throw createAIError(AIErrorCode.EXECUTION_EMPTY_RESPONSE, { requestId });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let finishReason: AIResponse['finishReason'];

      try {
        // 处理缓冲区以正确处理跨越多个 chunk 的行
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          // 按行分割处理
          const lines = buffer.split('\n');
          // 保留最后一个可能不完整的行
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            
            // 提取 SSE data 内容 - 兼容多种格式
            // 1. "data: {...}" (OpenAI 标准格式，冒号后有空格)
            // 2. "data:{...}" (Venus 格式，冒号后无空格)
            // 3. "data: [DONE]" 或 "data:[DONE]" (结束标记)
            const sseData = this.extractSSEData(trimmedLine);
            
            if (sseData !== null) {
              // 处理结束标记
              if (sseData === '[DONE]') continue;
              
              try {
                const parsed = JSON.parse(sseData);
                const content = this.extractStreamContent(parsed, config.provider);
                
                if (content) {
                  fullContent += content;
                  yield content;
                }

                // 检查完成原因 - 兼容 OpenAI/Venus 格式
                const reason = parsed.choices?.[0]?.finish_reason;
                if (reason) {
                  finishReason = reason === 'STOP' ? 'stop' : reason.toLowerCase() as AIResponse['finishReason'];
                }
              } catch {
                // 忽略解析错误，继续处理下一行
              }
            }
            // Gemini SSE 格式: 直接是 JSON 对象（不带 data: 前缀）
            else if (config.provider === 'gemini' && trimmedLine.startsWith('{')) {
              try {
                const parsed = JSON.parse(trimmedLine);
                const content = this.extractStreamContent(parsed, config.provider);
                
                if (content) {
                  fullContent += content;
                  yield content;
                }
                
                // Gemini 的完成标志在 finishReason 字段
                const reason = parsed.candidates?.[0]?.finishReason;
                if (reason) {
                  finishReason = reason === 'STOP' ? 'stop' : reason.toLowerCase() as AIResponse['finishReason'];
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        }
        
        // 处理缓冲区中剩余的内容
        if (buffer.trim()) {
          const trimmedBuffer = buffer.trim();
          const bufferSSEData = this.extractSSEData(trimmedBuffer);
          
          if (bufferSSEData !== null && bufferSSEData !== '[DONE]') {
            try {
              const parsed = JSON.parse(bufferSSEData);
              const content = this.extractStreamContent(parsed, config.provider);
              if (content) {
                fullContent += content;
                yield content;
              }
            } catch {
              // 忽略
            }
          } else if (config.provider === 'gemini' && trimmedBuffer.startsWith('{')) {
            try {
              const parsed = JSON.parse(trimmedBuffer);
              const content = this.extractStreamContent(parsed, config.provider);
              if (content) {
                fullContent += content;
                yield content;
              }
            } catch {
              // 忽略
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      if (!fullContent) {
        throw createAIError(AIErrorCode.EXECUTION_EMPTY_RESPONSE, { requestId });
      }

      return {
        content: fullContent,
        model: params.model || config.defaultModel,
        finishReason,
        requestId,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof AIServiceError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw createAIError(AIErrorCode.NETWORK_TIMEOUT, {
          originalError: error,
          requestId,
        });
      }

      throw wrapError(error, requestId);
    }
  }

  /**
   * 执行流式请求（带回调）
   */
  async streamWithCallbacks(
    params: AIRequestParams,
    callbacks: StreamCallbacks
  ): Promise<AIResponse> {
    let accumulated = '';

    try {
      const generator = this.stream(params);
      let result: IteratorResult<string, AIResponse>;

      while (!(result = await generator.next()).done) {
        const chunk = result.value;
        accumulated += chunk;
        callbacks.onChunk?.(chunk, accumulated);
      }

      const response = result.value;
      callbacks.onComplete?.(response);
      return response;
    } catch (error) {
      const aiError = error instanceof AIServiceError 
        ? error 
        : wrapError(error);
      callbacks.onError?.(aiError);
      throw aiError;
    }
  }

  /**
   * 从响应中提取内容
   */
  private extractContent(data: any, provider: string): string {
    switch (provider) {
      case 'anthropic':
        return data.content?.[0]?.text || '';
      case 'gemini':
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      case 'openai':
      case 'venus':
      case 'custom':
      default:
        return data.choices?.[0]?.message?.content || '';
    }
  }

  /**
   * 从流式响应中提取内容
   */
  private extractStreamContent(data: any, provider: string): string {
    switch (provider) {
      case 'anthropic':
        return data.delta?.text || '';
      case 'gemini':
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      case 'openai':
      case 'venus':
      case 'custom':
      default:
        return data.choices?.[0]?.delta?.content || '';
    }
  }

  /**
   * 提取 SSE 数据内容
   * 兼容多种格式：
   * - "data: {...}" (OpenAI 标准格式，冒号后有空格)
   * - "data:{...}" (Venus 格式，冒号后无空格)
   * - "data: [DONE]" 或 "data:[DONE]" (结束标记)
   */
  private extractSSEData(line: string): string | null {
    // 检查是否是 SSE data 行
    if (!line.startsWith('data:')) {
      return null;
    }
    
    // 提取 data: 后面的内容
    // 支持 "data: xxx" 和 "data:xxx" 两种格式
    let content = line.slice(5); // 去掉 "data:"
    
    // 如果第一个字符是空格，去掉它
    if (content.startsWith(' ')) {
      content = content.slice(1);
    }
    
    return content.trim();
  }
}

// ============================================================================
// 单例实例
// ============================================================================

let defaultClient: AIClient | null = null;

/**
 * 获取默认 AI 客户端实例
 */
export function getAIClient(): AIClient {
  if (!defaultClient) {
    defaultClient = new AIClient();
  }
  return defaultClient;
}

/**
 * 重置默认客户端（用于测试或重新配置）
 */
export function resetAIClient(): void {
  defaultClient = null;
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 快速执行 AI 请求（非流式）
 */
export async function aiComplete(params: AIRequestParams): Promise<AIResponse> {
  return getAIClient().complete(params);
}

/**
 * 快速执行 AI 请求（流式）
 */
export function aiStream(params: AIRequestParams): AsyncGenerator<string, AIResponse, undefined> {
  return getAIClient().stream(params);
}

/**
 * 检查 AI 服务是否可用
 */
export function isAIAvailable(): boolean {
  return getAIClient().isAvailable();
}

/**
 * 获取 AI 服务状态
 */
export function getAIStatus(): { available: boolean; errors: string[] } {
  const client = getAIClient();
  const validation = client.getValidation();
  return {
    available: validation.valid,
    errors: validation.errors,
  };
}

// ============================================================================
// 语音转写功能
// ============================================================================

/**
 * 语音转写请求参数
 */
export interface TranscribeParams {
  /** 音频数据 (base64 编码) */
  audio: string;
  /** 音频格式 (如 webm, wav, mp3) */
  format?: string;
  /** 语言提示 (如 zh, en) */
  language?: string;
  /** 请求 ID（用于追踪） */
  requestId?: string;
}

/**
 * 语音转写响应
 */
export interface TranscribeResponse {
  /** 转写文本 */
  text: string;
  /** 检测到的语言 */
  language?: string;
  /** 请求 ID */
  requestId?: string;
}

/**
 * 执行语音转写
 * 使用 Whisper API 将音频转换为文本
 */
export async function transcribeAudio(params: TranscribeParams): Promise<TranscribeResponse> {
  const config = loadAIConfig();
  const requestId = params.requestId || `transcribe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  if (!config || !config.apiKey) {
    throw createAIError(AIErrorCode.CONFIG_MISSING_API_KEY, { requestId });
  }

  // 将 base64 转换为 Blob
  const audioBuffer = Buffer.from(params.audio, 'base64');
  const audioBlob = new Blob([audioBuffer], { 
    type: `audio/${params.format || 'webm'}` 
  });
  
  // 构建 FormData
  const formData = new FormData();
  formData.append('file', audioBlob, `audio.${params.format || 'webm'}`);
  formData.append('model', 'whisper-1');
  if (params.language) {
    formData.append('language', params.language);
  }
  
  // 构建 Whisper API URL
  // 如果使用 OpenAI，直接使用 OpenAI 的 Whisper endpoint
  // 如果使用其他服务，尝试调整 URL
  const whisperUrl = config.apiUrl.includes('openai.com')
    ? 'https://api.openai.com/v1/audio/transcriptions'
    : `${config.apiUrl.replace(/\/chat\/completions$/, '').replace(/\/$/, '')}/audio/transcriptions`;
  
  try {
    const response = await fetch(whisperUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      console.error('[Transcribe API Error]', response.status, errorBody);
      
      // 如果 Whisper 不可用，返回服务不可用错误
      if (response.status === 404 || response.status === 400) {
        throw createAIError(AIErrorCode.API_SERVICE_UNAVAILABLE, {
          requestId,
          customMessage: '语音转写服务暂不可用，请尝试使用文字输入',
        });
      }
      
      throw errorFromHttpStatus(response.status, errorBody, requestId);
    }
    
    const result = await response.json();
    
    return {
      text: result.text,
      language: result.language,
      requestId,
    };
  } catch (error) {
    if (error instanceof AIServiceError) {
      throw error;
    }
    
    throw wrapError(error, requestId);
  }
}

/**
 * 检查语音转写服务是否可用
 */
export function isTranscribeAvailable(): boolean {
  const config = loadAIConfig();
  // 目前只有 OpenAI 和兼容的服务支持 Whisper
  return !!(config?.apiKey && (
    config.provider === 'openai' || 
    config.apiUrl.includes('openai.com')
  ));
}

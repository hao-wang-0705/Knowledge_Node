/**
 * AI 服务配置
 * 集中管理所有 AI 相关的配置项
 */

/**
 * 支持的 AI 模型
 */
export type AIModel =
  | 'gpt-4'
  | 'gpt-4-turbo'
  | 'gpt-3.5-turbo'
  | 'claude-3-opus'
  | 'claude-3-sonnet'
  | 'claude-3-haiku'
  | 'hunyuan-turbo'
  | 'hunyuan-pro'
  | 'deepseek-chat'
  | 'gemini-3.1-flash-lite'
  | 'gemini-2.5-flash'
  | 'gemini-2.0-flash'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash';

/**
 * AI 提供商类型
 */
export type AIProvider = 'openai' | 'anthropic' | 'venus' | 'gemini' | 'custom';

/**
 * AI 服务配置接口
 */
export interface AIServiceConfig {
  /** API 基础 URL */
  apiUrl: string;
  /** API 密钥 */
  apiKey: string;
  /** 默认模型 */
  defaultModel: AIModel;
  /** 提供商类型 */
  provider: AIProvider;
  /** 请求超时时间（毫秒） */
  timeout: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 是否启用流式输出 */
  enableStreaming: boolean;
}

/**
 * 环境变量配置映射
 */
const ENV_KEYS = {
  // OpenAI 配置
  OPENAI_API_KEY: 'OPENAI_API_KEY',
  OPENAI_API_URL: 'OPENAI_API_URL',

  // Venus 配置（腾讯内部）
  VENUS_API_KEY: 'VENUS_API_KEY',
  VENUS_API_URL: 'NEXT_PUBLIC_VENUS_API_URL',
  VENUS_MODEL: 'NEXT_PUBLIC_VENUS_MODEL',

  // Gemini 配置
  GEMINI_API_KEY: 'GEMINI_API_KEY',
  GEMINI_MODEL: 'NEXT_PUBLIC_GEMINI_MODEL',

  // 通用 AI 配置
  AI_API_KEY: 'AI_API_KEY',
  AI_API_URL: 'NEXT_PUBLIC_AI_API_URL',
  AI_DEFAULT_MODEL: 'NEXT_PUBLIC_AI_DEFAULT_MODEL',
  AI_PROVIDER: 'NEXT_PUBLIC_AI_PROVIDER',
  AI_TIMEOUT: 'NEXT_PUBLIC_AI_TIMEOUT',
  AI_MAX_RETRIES: 'NEXT_PUBLIC_AI_MAX_RETRIES',
  AI_ENABLE_STREAMING: 'NEXT_PUBLIC_AI_ENABLE_STREAMING',
} as const;

/**
 * 默认配置值
 */
const DEFAULT_CONFIG: Partial<AIServiceConfig> = {
  timeout: 60000, // 60 秒
  maxRetries: 3,
  enableStreaming: true,
  defaultModel: 'gpt-4',
  provider: 'openai',
};

/**
 * OpenAI API 默认端点
 */
const OPENAI_API_URL = 'https://api.openai.com/v1';

/**
 * Gemini API 默认端点
 */
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * 加载 AI 服务配置
 * 优先级：通用 AI 配置 > Gemini 配置 > Venus 配置 > OpenAI 配置
 */
export function loadAIConfig(): AIServiceConfig | null {
  // 尝试加载通用 AI 配置
  const aiApiKey = process.env[ENV_KEYS.AI_API_KEY];
  const aiApiUrl = process.env[ENV_KEYS.AI_API_URL];

  if (aiApiKey && aiApiUrl) {
    return {
      apiKey: aiApiKey,
      apiUrl: aiApiUrl,
      defaultModel: (process.env[ENV_KEYS.AI_DEFAULT_MODEL] as AIModel) || DEFAULT_CONFIG.defaultModel!,
      provider: (process.env[ENV_KEYS.AI_PROVIDER] as AIProvider) || DEFAULT_CONFIG.provider!,
      timeout: parseInt(process.env[ENV_KEYS.AI_TIMEOUT] || '', 10) || DEFAULT_CONFIG.timeout!,
      maxRetries: parseInt(process.env[ENV_KEYS.AI_MAX_RETRIES] || '', 10) || DEFAULT_CONFIG.maxRetries!,
      enableStreaming: process.env[ENV_KEYS.AI_ENABLE_STREAMING] !== 'false',
    };
  }

  // 尝试加载 Gemini 配置
  const geminiApiKey = process.env[ENV_KEYS.GEMINI_API_KEY];

  if (geminiApiKey) {
    return {
      apiKey: geminiApiKey,
      apiUrl: GEMINI_API_URL,
      defaultModel: (process.env[ENV_KEYS.GEMINI_MODEL] as AIModel) || 'gemini-2.5-flash',
      provider: 'gemini',
      timeout: DEFAULT_CONFIG.timeout!,
      maxRetries: DEFAULT_CONFIG.maxRetries!,
      enableStreaming: true,
    };
  }

  // 尝试加载 Venus 配置
  const venusApiKey = process.env[ENV_KEYS.VENUS_API_KEY];
  const venusApiUrl = process.env[ENV_KEYS.VENUS_API_URL];

  if (venusApiKey && venusApiUrl) {
    return {
      apiKey: venusApiKey,
      apiUrl: venusApiUrl,
      defaultModel: (process.env[ENV_KEYS.VENUS_MODEL] as AIModel) || 'hunyuan-turbo',
      provider: 'venus',
      timeout: DEFAULT_CONFIG.timeout!,
      maxRetries: DEFAULT_CONFIG.maxRetries!,
      enableStreaming: true,
    };
  }

  // 尝试加载 OpenAI 配置
  const openaiApiKey = process.env[ENV_KEYS.OPENAI_API_KEY];

  if (openaiApiKey) {
    return {
      apiKey: openaiApiKey,
      apiUrl: process.env[ENV_KEYS.OPENAI_API_URL] || OPENAI_API_URL,
      defaultModel: 'gpt-4',
      provider: 'openai',
      timeout: DEFAULT_CONFIG.timeout!,
      maxRetries: DEFAULT_CONFIG.maxRetries!,
      enableStreaming: true,
    };
  }

  // 没有配置任何 API
  return null;
}

/**
 * 验证配置是否完整
 */
export function validateConfig(config: AIServiceConfig | null): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config) {
    errors.push('未配置任何 AI 服务。请设置 GEMINI_API_KEY、OPENAI_API_KEY、VENUS_API_KEY 或 AI_API_KEY 环境变量。');
    return { valid: false, errors };
  }

  if (!config.apiKey) {
    errors.push('API 密钥未配置');
  }

  if (!config.apiUrl) {
    errors.push('API URL 未配置');
  }

  if (!config.defaultModel) {
    errors.push('默认模型未配置');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 获取当前配置的描述（用于日志，隐藏敏感信息）
 */
export function getConfigDescription(config: AIServiceConfig | null): string {
  if (!config) {
    return 'AI 服务未配置';
  }

  return `AI 服务配置: Provider=${config.provider}, Model=${config.defaultModel}, URL=${config.apiUrl}, Streaming=${config.enableStreaming}`;
}

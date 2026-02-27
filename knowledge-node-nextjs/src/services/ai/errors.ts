/**
 * AI 服务错误类型系统
 * 提供详细、结构化的错误信息，严禁 mock 数据兜底
 */

/**
 * AI 错误代码枚举
 */
export enum AIErrorCode {
  // 配置错误 (1xxx)
  CONFIG_MISSING_API_KEY = 'AI_CONFIG_1001',
  CONFIG_MISSING_API_URL = 'AI_CONFIG_1002',
  CONFIG_INVALID_MODEL = 'AI_CONFIG_1003',
  CONFIG_MISSING_PROMPT = 'AI_CONFIG_1004',

  // 网络错误 (2xxx)
  NETWORK_CONNECTION_FAILED = 'AI_NETWORK_2001',
  NETWORK_TIMEOUT = 'AI_NETWORK_2002',
  NETWORK_SSL_ERROR = 'AI_NETWORK_2003',

  // API 错误 (3xxx)
  API_UNAUTHORIZED = 'AI_API_3001',
  API_FORBIDDEN = 'AI_API_3002',
  API_RATE_LIMITED = 'AI_API_3003',
  API_MODEL_NOT_FOUND = 'AI_API_3004',
  API_QUOTA_EXCEEDED = 'AI_API_3005',
  API_INVALID_REQUEST = 'AI_API_3006',
  API_SERVER_ERROR = 'AI_API_3007',
  API_SERVICE_UNAVAILABLE = 'AI_API_3008',

  // 执行错误 (4xxx)
  EXECUTION_CONTEXT_TOO_LARGE = 'AI_EXEC_4001',
  EXECUTION_RESPONSE_PARSE_FAILED = 'AI_EXEC_4002',
  EXECUTION_STREAM_INTERRUPTED = 'AI_EXEC_4003',
  EXECUTION_EMPTY_RESPONSE = 'AI_EXEC_4004',
  EXECUTION_CANCELLED = 'AI_EXEC_4005',

  // 未知错误 (9xxx)
  UNKNOWN_ERROR = 'AI_UNKNOWN_9999',
}

/**
 * AI 错误详情接口
 */
export interface AIErrorDetails {
  /** 错误代码 */
  code: AIErrorCode;
  /** 用户友好的错误消息 */
  message: string;
  /** 技术错误详情 */
  technicalDetails?: string;
  /** HTTP 状态码（如果适用） */
  httpStatus?: number;
  /** 原始错误 */
  originalError?: Error;
  /** 建议的解决方案 */
  suggestion?: string;
  /** 是否可重试 */
  retryable: boolean;
  /** 重试延迟（毫秒） */
  retryAfter?: number;
  /** 时间戳 */
  timestamp: number;
  /** 请求 ID（用于追踪） */
  requestId?: string;
}

/**
 * AI 服务错误类
 * 继承自标准 Error，添加结构化错误信息
 */
export class AIServiceError extends Error {
  public readonly code: AIErrorCode;
  public readonly technicalDetails?: string;
  public readonly httpStatus?: number;
  public readonly originalError?: Error;
  public readonly suggestion?: string;
  public readonly retryable: boolean;
  public readonly retryAfter?: number;
  public readonly timestamp: number;
  public readonly requestId?: string;

  constructor(details: Omit<AIErrorDetails, 'timestamp'>) {
    super(details.message);
    this.name = 'AIServiceError';
    this.code = details.code;
    this.technicalDetails = details.technicalDetails;
    this.httpStatus = details.httpStatus;
    this.originalError = details.originalError;
    this.suggestion = details.suggestion;
    this.retryable = details.retryable;
    this.retryAfter = details.retryAfter;
    this.timestamp = Date.now();
    this.requestId = details.requestId;

    // 保持原始堆栈跟踪
    if (details.originalError?.stack) {
      this.stack = `${this.stack}\nCaused by: ${details.originalError.stack}`;
    }
  }

  /**
   * 转换为可序列化的对象
   */
  toJSON(): AIErrorDetails {
    return {
      code: this.code,
      message: this.message,
      technicalDetails: this.technicalDetails,
      httpStatus: this.httpStatus,
      suggestion: this.suggestion,
      retryable: this.retryable,
      retryAfter: this.retryAfter,
      timestamp: this.timestamp,
      requestId: this.requestId,
    };
  }

  /**
   * 获取用户友好的错误消息
   */
  getUserMessage(): string {
    const suggestionText = this.suggestion ? `\n建议：${this.suggestion}` : '';
    return `${this.message}${suggestionText}`;
  }
}

/**
 * 错误消息映射表
 */
const ERROR_MESSAGES: Record<AIErrorCode, { message: string; suggestion: string }> = {
  // 配置错误
  [AIErrorCode.CONFIG_MISSING_API_KEY]: {
    message: 'AI 服务未配置 API 密钥',
    suggestion: '请在环境变量中配置 OPENAI_API_KEY 或 VENUS_API_KEY',
  },
  [AIErrorCode.CONFIG_MISSING_API_URL]: {
    message: 'AI 服务未配置 API 地址',
    suggestion: '请在环境变量中配置 NEXT_PUBLIC_AI_API_URL',
  },
  [AIErrorCode.CONFIG_INVALID_MODEL]: {
    message: '指定的 AI 模型不存在或不可用',
    suggestion: '请检查模型名称是否正确，或选择其他可用模型',
  },
  [AIErrorCode.CONFIG_MISSING_PROMPT]: {
    message: '未提供有效的 Prompt 内容',
    suggestion: '请输入指令内容或选择一个预设模板',
  },

  // 网络错误
  [AIErrorCode.NETWORK_CONNECTION_FAILED]: {
    message: '无法连接到 AI 服务',
    suggestion: '请检查网络连接，或稍后重试',
  },
  [AIErrorCode.NETWORK_TIMEOUT]: {
    message: 'AI 服务响应超时',
    suggestion: '请减少输入内容长度，或稍后重试',
  },
  [AIErrorCode.NETWORK_SSL_ERROR]: {
    message: 'SSL/TLS 连接错误',
    suggestion: '请检查证书配置或联系管理员',
  },

  // API 错误
  [AIErrorCode.API_UNAUTHORIZED]: {
    message: 'API 密钥无效或已过期',
    suggestion: '请检查 API 密钥是否正确配置',
  },
  [AIErrorCode.API_FORBIDDEN]: {
    message: '无权访问该 AI 服务',
    suggestion: '请检查账户权限或联系管理员',
  },
  [AIErrorCode.API_RATE_LIMITED]: {
    message: 'API 请求频率超限',
    suggestion: '请稍后重试，或升级服务套餐',
  },
  [AIErrorCode.API_MODEL_NOT_FOUND]: {
    message: '请求的模型不存在',
    suggestion: '请选择其他可用的 AI 模型',
  },
  [AIErrorCode.API_QUOTA_EXCEEDED]: {
    message: 'API 配额已用完',
    suggestion: '请联系管理员增加配额，或等待配额重置',
  },
  [AIErrorCode.API_INVALID_REQUEST]: {
    message: 'API 请求参数无效',
    suggestion: '请检查输入内容格式',
  },
  [AIErrorCode.API_SERVER_ERROR]: {
    message: 'AI 服务内部错误',
    suggestion: '请稍后重试',
  },
  [AIErrorCode.API_SERVICE_UNAVAILABLE]: {
    message: 'AI 服务暂时不可用',
    suggestion: '服务正在维护中，请稍后重试',
  },

  // 执行错误
  [AIErrorCode.EXECUTION_CONTEXT_TOO_LARGE]: {
    message: '输入内容超过模型上下文限制',
    suggestion: '请减少输入内容长度，或使用支持更长上下文的模型',
  },
  [AIErrorCode.EXECUTION_RESPONSE_PARSE_FAILED]: {
    message: 'AI 响应解析失败',
    suggestion: '请重试，如问题持续请联系管理员',
  },
  [AIErrorCode.EXECUTION_STREAM_INTERRUPTED]: {
    message: '流式响应被中断',
    suggestion: '请检查网络连接并重试',
  },
  [AIErrorCode.EXECUTION_EMPTY_RESPONSE]: {
    message: 'AI 返回了空响应',
    suggestion: '请调整 Prompt 内容后重试',
  },
  [AIErrorCode.EXECUTION_CANCELLED]: {
    message: '请求已被取消',
    suggestion: '如需继续，请重新执行',
  },

  // 未知错误
  [AIErrorCode.UNKNOWN_ERROR]: {
    message: '发生未知错误',
    suggestion: '请稍后重试，如问题持续请联系管理员',
  },
};

/**
 * 创建 AI 服务错误的工厂函数
 */
export function createAIError(
  code: AIErrorCode,
  options?: {
    technicalDetails?: string;
    httpStatus?: number;
    originalError?: Error;
    retryable?: boolean;
    retryAfter?: number;
    requestId?: string;
    customMessage?: string;
    customSuggestion?: string;
  }
): AIServiceError {
  const defaultInfo = ERROR_MESSAGES[code] || ERROR_MESSAGES[AIErrorCode.UNKNOWN_ERROR];

  return new AIServiceError({
    code,
    message: options?.customMessage || defaultInfo.message,
    technicalDetails: options?.technicalDetails,
    httpStatus: options?.httpStatus,
    originalError: options?.originalError,
    suggestion: options?.customSuggestion || defaultInfo.suggestion,
    retryable: options?.retryable ?? isRetryable(code),
    retryAfter: options?.retryAfter,
    requestId: options?.requestId,
  });
}

/**
 * 判断错误是否可重试
 */
function isRetryable(code: AIErrorCode): boolean {
  const retryableCodes = [
    AIErrorCode.NETWORK_CONNECTION_FAILED,
    AIErrorCode.NETWORK_TIMEOUT,
    AIErrorCode.API_RATE_LIMITED,
    AIErrorCode.API_SERVER_ERROR,
    AIErrorCode.API_SERVICE_UNAVAILABLE,
    AIErrorCode.EXECUTION_STREAM_INTERRUPTED,
  ];
  return retryableCodes.includes(code);
}

/**
 * 从 HTTP 状态码推断错误类型
 */
export function errorFromHttpStatus(
  status: number,
  responseBody?: any,
  requestId?: string
): AIServiceError {
  let code: AIErrorCode;

  switch (status) {
    case 401:
      code = AIErrorCode.API_UNAUTHORIZED;
      break;
    case 403:
      code = AIErrorCode.API_FORBIDDEN;
      break;
    case 404:
      code = AIErrorCode.API_MODEL_NOT_FOUND;
      break;
    case 429:
      code = AIErrorCode.API_RATE_LIMITED;
      break;
    case 400:
      code = AIErrorCode.API_INVALID_REQUEST;
      break;
    case 500:
      code = AIErrorCode.API_SERVER_ERROR;
      break;
    case 502:
    case 503:
    case 504:
      code = AIErrorCode.API_SERVICE_UNAVAILABLE;
      break;
    default:
      code = AIErrorCode.UNKNOWN_ERROR;
  }

  const retryAfter = status === 429 
    ? parseInt(responseBody?.headers?.['retry-after'] || '60', 10) * 1000 
    : undefined;

  return createAIError(code, {
    httpStatus: status,
    technicalDetails: JSON.stringify(responseBody),
    retryAfter,
    requestId,
  });
}

/**
 * 包装并转换任意错误为 AIServiceError
 */
export function wrapError(error: unknown, requestId?: string): AIServiceError {
  if (error instanceof AIServiceError) {
    return error;
  }

  if (error instanceof Error) {
    // 网络错误检测
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return createAIError(AIErrorCode.NETWORK_CONNECTION_FAILED, {
        originalError: error,
        technicalDetails: error.message,
        requestId,
      });
    }

    // 超时错误检测
    if (error.message.includes('timeout') || error.name === 'AbortError') {
      return createAIError(AIErrorCode.NETWORK_TIMEOUT, {
        originalError: error,
        technicalDetails: error.message,
        requestId,
      });
    }

    // 通用错误
    return createAIError(AIErrorCode.UNKNOWN_ERROR, {
      originalError: error,
      technicalDetails: error.message,
      requestId,
    });
  }

  // 非 Error 类型
  return createAIError(AIErrorCode.UNKNOWN_ERROR, {
    technicalDetails: String(error),
    requestId,
  });
}

/**
 * AI 服务模块
 * 
 * 统一的 AI 服务接口，集成所有 AI 功能
 * 
 * v4.1 更新说明:
 * - AI 请求已迁移到后端 Agent 服务统一处理
 * - 前端 API 路由通过 HTTP 调用后端 Agent 的 Tool 接口
 * - 限流、重试、监控等由后端 Agent 统一管理
 * 
 * 当前保留的功能:
 * - AI 配置管理 (config.ts)
 * - 连通性测试和状态检查 (client.ts - status/test)
 * - 语音转写 (client.ts - transcribe，待迁移)
 * - Prompt 模板管理 (prompts.ts)
 */

// ============================================================================
// 核心客户端（前端本地配置检查、测试、语音转写）
// ============================================================================
export {
  AIClient,
  getAIClient,
  resetAIClient,
  aiComplete,
  aiStream,
  isAIAvailable,
  getAIStatus,
  // 语音转写
  transcribeAudio,
  isTranscribeAvailable,
  type AIRequestParams,
  type AIResponse,
  type StreamCallbacks,
  type TranscribeParams,
  type TranscribeResponse,
} from './client';

// 错误处理
export {
  AIServiceError,
  AIErrorCode,
  createAIError,
  errorFromHttpStatus,
  wrapError,
  type AIErrorDetails,
} from './errors';

// 配置管理
export {
  loadAIConfig,
  validateConfig,
  getConfigDescription,
  type AIServiceConfig,
  type AIModel,
  type AIProvider,
} from './config';

// Prompt 管理
export {
  // 模板
  SYSTEM_PROMPTS,
  TEMPLATE_VARIABLES,
  // Prompt 构建
  fillPromptVariables,
  buildFullPrompt,
  // Token 工具
  estimateTokenCount,
  getModelTokenLimit,
  DEFAULT_MAX_TOKENS,
  MODEL_TOKEN_LIMITS,
  // 快速捕获相关
  CAPTURE_SYSTEM_PROMPT,
  buildCapturePrompt,
  parseCaptureResponse,
  // v3.5: 智能捕获 Prompt 相关
  SMART_CAPTURE_SYSTEM_PROMPT,
  buildSmartCapturePrompt,
  // v3.5: 搜索条件自然语言解析 Prompt 相关
  SEARCH_NL_PARSE_SYSTEM_PROMPT,
  buildSearchNLParsePrompt,
  parseSearchNLResponse,
  type PromptVariables,
  type SupertagSchema,
  type CapturePromptParams,
  type CaptureStructuredResponse,
  type SmartCaptureTagSchema,
  type SmartCapturePromptParams,
  type SearchNLTagSchema,
  type SearchNLParsePromptParams,
  type SearchNLParseResponse,
} from './prompts';

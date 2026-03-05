/**
 * AI 服务模块
 * 
 * 统一的 AI 服务接口，集成所有 AI 功能
 * 
 * 推荐使用方法（通过网关层）：
 * 
 * ```typescript
 * import { 
 *   gatewayComplete, 
 *   gatewayStream, 
 *   gatewayTranscribe,
 *   isGatewayAvailable, 
 *   getGatewayStatus 
 * } from '@/services/ai';
 * 
 * // 检查 AI 服务状态
 * if (!isGatewayAvailable()) {
 *   const status = getGatewayStatus();
 *   console.error('AI 服务不可用:', status.errors);
 *   throw new Error(status.errors[0]);
 * }
 * 
 * // 非流式调用（通过网关，带限流和重试）
 * const response = await gatewayComplete({
 *   prompt: '帮我总结这段内容',
 *   variables: { context: '...' },
 *   category: 'summary',
 * });
 * 
 * // 流式调用
 * for await (const chunk of gatewayStream({ prompt: '...' })) {
 *   console.log(chunk);
 * }
 * 
 * // 语音转写
 * const transcription = await gatewayTranscribe({
 *   audio: base64Audio,
 *   format: 'webm',
 *   language: 'zh',
 * });
 * 
 * // 使用预设模板
 * import { getTemplateById, fillPromptVariables } from '@/services/ai';
 * 
 * const template = getTemplateById('weekly-report');
 * const prompt = fillPromptVariables(template.prompt, {
 *   context: '本周内容...'
 * });
 * 
 * const result = await gatewayComplete({ prompt });
 * ```
 */

// AI 网关层（推荐使用）
export {
  AIGateway,
  getAIGateway,
  resetAIGateway,
  gatewayComplete,
  gatewayStream,
  gatewayTranscribe,
  isGatewayAvailable,
  getGatewayStatus,
  getGatewayMetrics,
  type GatewayConfig,
  type RequestMetrics,
} from './gateway';

// 核心客户端（底层 API，建议通过网关层调用）
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
  COMMAND_TEMPLATES,
  SYSTEM_PROMPTS,
  TEMPLATE_VARIABLES,
  // 模板查询
  getTemplateById,
  getTemplatesByCategory,
  getTemplateCategories,
  searchTemplates,
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
  // Schema 生成相关
  SCHEMA_GENERATION_SYSTEM_PROMPT,
  buildSchemaGeneratePrompt,
  parseSchemaGenerateResponse,
  // v3.4: AI 字段 Prompt 相关
  AI_FIELD_PROMPTS,
  buildAIFieldPrompt,
  parseAIFieldResponse,
  getAIFieldDefaultValue,
  // v3.5: 笔记格式化 Prompt 相关
  FORMAT_NOTES_SYSTEM_PROMPT,
  buildFormatNotesPrompt,
  type PromptVariables,
  type SupertagSchema,
  type CapturePromptParams,
  type CaptureStructuredResponse,
  type SchemaGenerateParams,
  type SchemaGenerateResponse,
  type AIFieldPromptParams,
  type FormatNotesParams,
} from './prompts';

// v3.4: AI 字段处理器
export {
  AIFieldProcessor,
  getAIFieldProcessor,
  processAIField,
  processNodeAIFields,
  hasAIFields,
  getAIFieldDefinitions,
  type AIFieldProcessRequest,
  type AIFieldProcessResult,
  type BatchProcessResult,
} from './field-processor';

/**
 * @deprecated 此文件已迁移到 @/services/ai/prompts
 * 请使用新的统一 AI 服务模块：
 * 
 * import { 
 *   COMMAND_TEMPLATES,
 *   getTemplateById,
 *   getTemplatesByCategory,
 *   fillPromptVariables,
 *   estimateTokenCount 
 * } from '@/services/ai';
 */

// 重新导出所有内容以保持向后兼容
export {
  COMMAND_TEMPLATES,
  getTemplateById,
  getTemplatesByCategory,
  getTemplateCategories,
  searchTemplates,
  fillPromptVariables as fillTemplateVariables,
  estimateTokenCount,
  DEFAULT_MAX_TOKENS,
  MODEL_TOKEN_LIMITS,
} from '@/services/ai/prompts';

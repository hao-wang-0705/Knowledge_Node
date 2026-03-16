/**
 * Prompt 集中管理模块
 * 统一管理所有 AI 功能的 Prompt 模板
 */

// ============================================================================
// Prompt 模板变量定义
// ============================================================================

/**
 * 系统支持的模板变量
 */
export const TEMPLATE_VARIABLES = {
  /** 节点内容上下文 */
  CONTEXT: '{{context}}',
  /** 当前日期 */
  DATE: '{{date}}',
  /** 当前周信息 */
  WEEK: '{{week}}',
  /** 当前月份 */
  MONTH: '{{month}}',
  /** 用户选中的节点 */
  SELECTION: '{{selection}}',
  /** 当前节点内容 */
  CURRENT_NODE: '{{currentNode}}',
  /** 父节点内容 */
  PARENT_NODE: '{{parentNode}}',
  /** 子节点内容 */
  CHILDREN_NODES: '{{childrenNodes}}',
} as const;

/**
 * 变量填充函数的参数类型
 */
export interface PromptVariables {
  context?: string;
  date?: string;
  week?: string;
  month?: string;
  selection?: string;
  currentNode?: string;
  parentNode?: string;
  childrenNodes?: string;
  [key: string]: string | undefined;
}

// ============================================================================
// 系统 Prompt 定义
// ============================================================================

/**
 * 系统角色 Prompt - 定义 AI 的基础行为
 */
export const SYSTEM_PROMPTS = {
  /** 通用助手角色 */
  DEFAULT: `你是一个智能笔记助手，擅长帮助用户整理、分析和扩展笔记内容。
请遵循以下原则：
1. 输出格式清晰，使用适当的标题和列表
2. 保持简洁，突出重点
3. 使用用户的语言风格
4. 如果内容不足以完成任务，明确说明需要什么信息`,

  /** 生产力助手 */
  PRODUCTIVITY: `你是一个专业的生产力助手，专注于帮助用户提升工作效率。
你的职责包括：
1. 生成结构化的报告和文档
2. 拆解复杂任务为可执行步骤
3. 整理会议纪要和行动项
4. 识别并提取关键信息

输出要求：
- 使用清晰的层级结构
- 标注优先级和截止日期（如适用）
- 确保内容可直接执行`,

  /** 分析师角色 */
  ANALYST: `你是一个数据分析专家，擅长从信息中提取洞察和模式。
分析原则：
1. 基于事实，避免主观臆断
2. 识别趋势和异常
3. 提供可操作的建议
4. 量化分析（如有数据）

输出格式：
- 摘要结论在前
- 详细分析在后
- 附带数据支撑（如适用）`,

  /** 创意写作 */
  CREATIVE: `你是一个创意写作助手，帮助用户进行头脑风暴和内容创作。
创作原则：
1. 鼓励发散思维，不设限制
2. 提供多样化的选择
3. 保持原创性
4. 适应用户的风格偏好

注意：在创意模式下，可以更加大胆和开放。`,

  /** 摘要生成 */
  SUMMARIZER: `你是一个专业的内容摘要专家，擅长提炼核心信息。
摘要原则：
1. 保留关键信息，删除冗余
2. 保持原意不变
3. 适当压缩篇幅
4. 使用清晰的结构

输出要求：
- 核心观点在前
- 重要细节在后
- 标注关键词或主题`,
} as const;

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 填充模板变量
 */
export function fillPromptVariables(
  template: string,
  variables: PromptVariables
): string {
  let result = template;

  // 填充预定义变量
  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined) {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), value);
    }
  }

  // 清理未填充的变量（替换为空字符串）
  result = result.replace(/\{\{[^}]+\}\}/g, '');

  return result.trim();
}

/**
 * 构建完整的 Prompt（包含系统提示和用户提示）
 */
export function buildFullPrompt(options: {
  systemPrompt?: string;
  userPrompt: string;
  variables?: PromptVariables;
  category?: string;
}): { system: string; user: string } {
  const { systemPrompt, userPrompt, variables = {}, category } = options;

  // 选择系统提示
  let system = systemPrompt || SYSTEM_PROMPTS.DEFAULT;
  if (!systemPrompt && category) {
    switch (category) {
      case 'productivity':
        system = SYSTEM_PROMPTS.PRODUCTIVITY;
        break;
      case 'analysis':
        system = SYSTEM_PROMPTS.ANALYST;
        break;
      case 'creative':
        system = SYSTEM_PROMPTS.CREATIVE;
        break;
      case 'summary':
        system = SYSTEM_PROMPTS.SUMMARIZER;
        break;
    }
  }

  // 填充用户提示中的变量
  const user = fillPromptVariables(userPrompt, variables);

  return { system, user };
}

/**
 * 估算 Prompt Token 数量（粗略估算）
 * 中文约 2 字符/token，英文约 4 字符/token
 */
export function estimateTokenCount(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 2 + otherChars / 4);
}

/**
 * 默认 Token 预算
 */
export const DEFAULT_MAX_TOKENS = 4000;

/**
 * 模型 Token 上限
 */
export const MODEL_TOKEN_LIMITS: Record<string, number> = {
  'gpt-4': 8192,
  'gpt-4-turbo': 128000,
  'gpt-3.5-turbo': 16385,
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'hunyuan-turbo': 32000,
  'hunyuan-pro': 32000,
  'deepseek-chat': 64000,
  'gemini-2.5-flash': 1000000,
  'gemini-2.0-flash': 1000000,
  'gemini-1.5-pro': 2000000,
  'gemini-1.5-flash': 1000000,
};

/**
 * 获取模型的 Token 上限
 */
export function getModelTokenLimit(model: string): number {
  return MODEL_TOKEN_LIMITS[model] || DEFAULT_MAX_TOKENS;
}

// ============================================================================
// 快速捕获 Prompt
// ============================================================================

/**
 * 快速捕获系统 Prompt
 * 用于多模态快速捕获功能的 AI 结构化处理
 */
export const CAPTURE_SYSTEM_PROMPT = `你是一个智能知识助手，专门帮助用户快速记录和结构化笔记。

你的任务是：
1. 分析用户输入的内容（可能是文本、图片描述或语音转写）
2. 从提供的 Supertag（超级标签）列表中选择最匹配的一个
3. 根据选中标签的字段定义，从内容中提取相应的值
4. 返回结构化的 JSON 结果

## 匹配规则
- 优先精确匹配：如果内容明确提到任务、会议、想法等关键词
- 根据语义判断：分析内容意图来匹配合适的标签
- 如果无法确定，返回 null 作为 supertagId
- 不要强制匹配，如果内容是普通笔记则不需要标签

## 字段提取规则
- 日期：识别"明天"、"下周五"、"3月15日"等表述，转换为 YYYY-MM-DD 格式
- 优先级：识别"紧急"、"重要"、"尽快"等词汇
- 状态：默认为初始状态（待办、计划中等）
- 参与人/负责人：识别人名或 @ 开头的引用

## 输出要求
只返回 JSON，不要添加任何解释或 markdown 代码块标记。`;

/**
 * Supertag Schema (精简版)
 */
export interface SupertagSchema {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  fields: Array<{
    key: string;
    name: string;
    type: string;
    options?: string[];
  }>;
}

/**
 * 捕获请求参数
 */
export interface CapturePromptParams {
  /** 文本输入 */
  text?: string;
  /** 图片数量（用于描述） */
  imageCount?: number;
  /** 语音转写文本 */
  voiceTranscription?: string;
  /** 用户手动指定的标签 ID */
  manualTagId?: string;
  /** 可用的 Supertag Schema 列表 */
  supertags: SupertagSchema[];
}

/**
 * 构建快速捕获的用户 Prompt
 */
export function buildCapturePrompt(params: CapturePromptParams): string {
  const { text, imageCount, voiceTranscription, manualTagId, supertags } = params;
  
  // 构建输入内容
  const inputParts: string[] = [];
  
  if (text?.trim()) {
    inputParts.push(`文本输入：${text.trim()}`);
  }
  
  if (voiceTranscription?.trim()) {
    inputParts.push(`语音转写：${voiceTranscription.trim()}`);
  }
  
  if (imageCount && imageCount > 0) {
    inputParts.push(`附带图片：${imageCount} 张`);
  }
  
  // 构建标签列表
  const tagList = supertags.map((tag) => {
    const fieldsDesc = tag.fields
      .map((f) => `${f.name}(${f.key}): ${f.type}${f.options ? `, 选项: ${f.options.join('/')}` : ''}`)
      .join('; ');
    return `- ${tag.icon || '📌'} ${tag.name} (ID: ${tag.id})${tag.description ? `: ${tag.description}` : ''}\n  字段: ${fieldsDesc || '无'}`;
  }).join('\n');
  
  // 获取今天日期用于相对日期计算
  const today = new Date();
  const dateContext = `今天是 ${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日，星期${['日', '一', '二', '三', '四', '五', '六'][today.getDay()]}`;
  
  let prompt = `## 用户输入
${inputParts.join('\n\n')}

## 日期上下文
${dateContext}

## 可用标签列表
${tagList || '暂无标签'}
`;

  if (manualTagId) {
    const manualTag = supertags.find((t) => t.id === manualTagId);
    if (manualTag) {
      prompt += `\n## 用户指定标签
用户已手动选择标签：${manualTag.icon || '📌'} ${manualTag.name} (ID: ${manualTagId})
请使用此标签并提取相应字段。\n`;
    }
  }
  
  prompt += `
## 输出格式
请返回以下 JSON 格式（不要包含 markdown 代码块）：
{
  "content": "整理后的节点正文内容",
  "supertagId": "匹配的标签ID或null",
  "fields": {
    "字段key": "提取的值"
  },
  "confidence": 0.8,
  "alternativeTags": ["备选标签ID"]
}`;

  return prompt;
}

/**
 * AI 结构化响应类型
 */
export interface CaptureStructuredResponse {
  /** 节点正文内容 */
  content: string;
  /** 匹配的 Supertag ID */
  supertagId: string | null;
  /** 提取的字段值 */
  fields: Record<string, unknown>;
  /** 置信度 */
  confidence: number;
  /** 替代标签建议 */
  alternativeTags?: string[];
}

/**
 * 解析捕获 AI 响应
 */
export function parseCaptureResponse(content: string): CaptureStructuredResponse {
  // 尝试清理可能的 markdown 代码块标记
  let cleaned = content.trim();
  
  // 移除 ```json 和 ``` 标记
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  
  try {
    const parsed = JSON.parse(cleaned);
    
    return {
      content: parsed.content || '',
      supertagId: parsed.supertagId || null,
      fields: parsed.fields || {},
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
      alternativeTags: Array.isArray(parsed.alternativeTags) ? parsed.alternativeTags : undefined,
    };
  } catch (e) {
    // 解析失败时，返回原始文本作为 content
    console.error('[AI Capture] Failed to parse AI response:', e);
    return {
      content: content,
      supertagId: null,
      fields: {},
      confidence: 0,
    };
  }
}

// ============================================================================
// 智能捕获 Prompt 模块 (Smart Capture)
// v3.5: 合并"文本格式化整理"与"意图及标签预测"能力
// ============================================================================

/**
 * 智能捕获系统 Prompt
 * 在单次 AI 调用中同时完成：
 * 1. 文本降噪与格式化（树形节点拆分）
 * 2. 意图识别与标签匹配
 * 3. 槽位填充（Slot Filling）
 */
export const SMART_CAPTURE_SYSTEM_PROMPT = `你是一个专业的知识管理助手，擅长将非结构化文字整理为结构化知识节点。

核心任务：
1. 分析文本内容，按主题拆分为层次清晰的树形节点（最多 3 层嵌套）
2. 为每个节点匹配最合适的超级标签（从提供的标签列表中选择）
3. 从节点内容中提取关键信息填充到标签字段中

## 标签匹配规则
- **单标签策略**：每个节点仅匹配置信度最高的一个标签
- 优先精确匹配：如果内容明确提到任务、会议、想法等关键词
- 根据语义判断：分析内容意图来匹配合适的标签
- **置信度阈值 > 0.8**：低于此阈值时，supertagId 设为 null
- 不要强制匹配，普通笔记内容可以不挂载标签

## 字段提取规则
- 日期：识别"明天"、"下周五"、"3月15日"等表述，转换为 YYYY-MM-DD 格式
- 优先级：识别"紧急"、"重要"、"尽快"等词汇
- 状态：默认为初始状态（待办、计划中等）
- 参与人/负责人：识别人名或 @ 开头的引用
- **字段类型校验失败时，该字段留空，不强行填充**

## 输出规则
- 必须输出 JSON 数组格式，按深度优先顺序排列
- 每个节点包含：tempId、content、parentTempId、supertagId、fields、confidence、isAIExtracted
- 根节点的 parentTempId 为 null
- 确保父节点在子节点之前输出
- 如果文本无法有意义地拆分，返回单个根节点
- 不要添加 markdown 代码块标记，直接返回 JSON

## 输出示例
输入："今天开会讨论了两个任务：1. 产品上线，截止日期下周五，负责人小明，很紧急 2. 市场推广方案，下月初提交"

输出：
[
  {"tempId":"1","content":"会议讨论事项","parentTempId":null,"supertagId":null,"fields":{},"confidence":0.6,"isAIExtracted":true},
  {"tempId":"2","content":"产品上线","parentTempId":"1","supertagId":"task","fields":{"due_date":"2024-03-15","assignee":"小明","priority":"P0"},"confidence":0.95,"isAIExtracted":true},
  {"tempId":"3","content":"市场推广方案","parentTempId":"1","supertagId":"task","fields":{"due_date":"2024-04-01"},"confidence":0.88,"isAIExtracted":true}
]`;

/**
 * 智能捕获 Supertag Schema (精简版，用于 Prompt)
 */
export interface SmartCaptureTagSchema {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  fields: Array<{
    key: string;
    name: string;
    type: string;
    options?: string[];
  }>;
}

/**
 * 智能捕获请求参数
 */
export interface SmartCapturePromptParams {
  /** 用户输入的文本 */
  text: string;
  /** 可用的 Supertag Schema 列表 */
  supertags: SmartCaptureTagSchema[];
}

/**
 * 构建智能捕获 Prompt
 */
export function buildSmartCapturePrompt(params: SmartCapturePromptParams): string {
  const { text, supertags } = params;

  // 获取今天日期用于相对日期计算
  const today = new Date();
  const dateContext = `今天是 ${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日，星期${['日', '一', '二', '三', '四', '五', '六'][today.getDay()]}`;

  // 构建标签列表
  const tagList = supertags.map((tag) => {
    const fieldsDesc = tag.fields
      .map((f) => `${f.name}(${f.key}): ${f.type}${f.options ? `, 选项: ${f.options.join('/')}` : ''}`)
      .join('; ');
    return `- ${tag.icon || '📌'} ${tag.name} (ID: ${tag.id})${tag.description ? `: ${tag.description}` : ''}\n  字段: ${fieldsDesc || '无'}`;
  }).join('\n');

  return `请将以下内容整理为结构化的知识节点，并为适合的节点匹配标签和提取字段：

## 日期上下文
${dateContext}

## 用户输入
${text}

## 可用标签列表
${tagList || '暂无标签（所有节点 supertagId 设为 null）'}

## 输出格式
请直接返回 JSON 数组，不要包含任何其他内容或 markdown 代码块标记。
每个节点结构如下：
{
  "tempId": "唯一临时ID",
  "content": "节点正文",
  "parentTempId": "父节点临时ID或null",
  "supertagId": "标签ID或null",
  "fields": {"字段key": "值"},
  "confidence": 0.0-1.0,
  "isAIExtracted": true
}`;
}

// ============================================================================
// 搜索条件自然语言解析 Prompt 模块
// v3.5: 将自然语言查询转换为结构化 SearchConfig
// ============================================================================

/**
 * 搜索条件解析系统 Prompt
 * 用于将自然语言描述的筛选条件转换为结构化的 SearchConfig
 */
export const SEARCH_NL_PARSE_SYSTEM_PROMPT = `你是一个智能查询助手，负责将用户的自然语言描述转换为结构化的搜索条件。

## 核心任务
将用户的自然语言查询解析为 JSON 格式的搜索配置，确保输出与系统现有的 SearchConfig 结构完全兼容。

## 支持的条件类型
1. **keyword**: 节点文本关键词匹配
   - operator: contains（包含）, equals（精确匹配）
   - value: 字符串

2. **tag**: 标签筛选（supertagId）
   - operator: equals（等于）, isNot（不等于）
   - value: 标签ID（从提供的标签列表中匹配）

3. **field**: 字段条件（匹配 fieldValues 中的字段）
   - operator: equals, contains, gt, lt, gte, lte, is, isNot, hasAny, hasAll
   - field: 字段 key（从提供的标签字段定义中匹配）
   - value: 根据字段类型确定格式

4. **date**: 时间条件（createdAt/updatedAt）
   - operator: today（今天）, withinDays（N天内）, gt, lt, gte, lte
   - field: createdAt 或 updatedAt
   - value: 日期字符串（YYYY-MM-DD）或天数

## 解析规则
1. **标签名称转ID**: 用户说"任务"时，匹配到对应标签的 ID
2. **相对日期转换**: "明天"→当前日期+1天，"下周五"→计算具体日期，"3天内"→使用 withinDays
3. **字段名匹配**: 用户说"截止日期"时，匹配到对应字段的 key（如 due_date）
4. **选项值匹配**: 用户说"未完成"时，匹配到字段选项中最接近的值
5. **逻辑组合**: 默认使用 AND，用户明确说"或者"时使用 OR

## 置信度评估
- 0.9+: 完全明确的查询，所有条件都能精确匹配
- 0.7-0.9: 大部分明确，少量需要推断
- 0.5-0.7: 存在歧义，可能需要确认
- <0.5: 无法理解意图，建议返回错误

## 输出规则
- 必须输出合法的 JSON
- success 为 true 时必须包含 config 和 explanation
- success 为 false 时必须包含 error 和 suggestions
- 不要猜测用户意图，宁可报错也不胡乱匹配
- 不要添加 markdown 代码块标记，直接返回 JSON`;

/**
 * Supertag Schema（用于搜索条件解析 Prompt）
 */
export interface SearchNLTagSchema {
  id: string;
  name: string;
  icon?: string;
  fields: Array<{
    key: string;
    name: string;
    type: 'text' | 'number' | 'date' | 'select';
    options?: string[];
  }>;
}

/**
 * 搜索条件解析请求参数
 */
export interface SearchNLParsePromptParams {
  /** 用户输入的自然语言查询 */
  query: string;
  /** 可用的 Supertag Schema 列表 */
  supertags: SearchNLTagSchema[];
  /** 当前日期（格式：YYYY-MM-DD） */
  currentDate: string;
}

/**
 * 构建搜索条件自然语言解析 Prompt
 */
export function buildSearchNLParsePrompt(params: SearchNLParsePromptParams): string {
  const { query, supertags, currentDate } = params;

  // 解析当前日期获取星期几
  const dateObj = new Date(currentDate);
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][dateObj.getDay()];
  const dateContext = `今天是 ${currentDate}（星期${weekday}）`;

  // 构建标签列表描述
  const tagListDesc = supertags.map((tag) => {
    const fieldsDesc = tag.fields
      .map((f) => {
        let desc = `${f.name}(key: ${f.key}, type: ${f.type})`;
        if (f.type === 'select' && f.options && f.options.length > 0) {
          desc += ` [选项: ${f.options.join(', ')}]`;
        }
        return desc;
      })
      .join('\n    - ');
    
    return `- ${tag.icon || '📌'} **${tag.name}** (ID: \`${tag.id}\`)
    ${fieldsDesc ? `字段:\n    - ${fieldsDesc}` : '无自定义字段'}`;
  }).join('\n\n');

  return `## 日期上下文
${dateContext}

## 用户查询
"${query}"

## 可用标签及字段定义
${tagListDesc || '暂无标签定义'}

## 输出格式
请直接返回 JSON，不要包含 markdown 代码块标记。

成功时：
{
  "success": true,
  "config": {
    "logicalOperator": "AND",
    "conditions": [
      { "type": "keyword", "operator": "contains", "value": "关键词" },
      { "type": "tag", "operator": "equals", "value": "标签ID" },
      { "type": "field", "field": "字段key", "operator": "操作符", "value": "值" },
      { "type": "date", "field": "createdAt", "operator": "withinDays", "value": 7 }
    ]
  },
  "explanation": "人类可读的条件描述",
  "confidence": 0.92
}

失败时：
{
  "success": false,
  "error": "无法理解您的查询意图",
  "suggestions": ["请尝试更具体的描述，例如..."]
}`;
}

/**
 * 搜索条件解析响应类型
 */
export interface SearchNLParseResponse {
  success: boolean;
  config?: {
    logicalOperator: 'AND' | 'OR';
    conditions: Array<{
      type: 'keyword' | 'tag' | 'field' | 'date' | 'ancestor';
      field?: string;
      operator: string;
      value: string | number | boolean | string[];
      negate?: boolean;
    }>;
  };
  explanation?: string;
  warnings?: string[];
  confidence?: number;
  error?: string;
  suggestions?: string[];
}

/**
 * 解析搜索条件 AI 响应
 */
export function parseSearchNLResponse(content: string): SearchNLParseResponse {
  // 清理可能的 markdown 代码块标记
  let cleaned = content.trim();
  
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  
  try {
    const parsed = JSON.parse(cleaned);
    
    // 验证基本结构
    if (typeof parsed.success !== 'boolean') {
      return {
        success: false,
        error: 'AI 响应格式错误：缺少 success 字段',
        suggestions: ['请重试或使用手动配置模式'],
      };
    }
    
    if (parsed.success) {
      // 验证成功响应的必要字段
      if (!parsed.config || !Array.isArray(parsed.config.conditions)) {
        return {
          success: false,
          error: 'AI 响应格式错误：缺少有效的 config',
          suggestions: ['请重试或使用手动配置模式'],
        };
      }
      
      return {
        success: true,
        config: {
          logicalOperator: parsed.config.logicalOperator || 'AND',
          conditions: parsed.config.conditions,
        },
        explanation: parsed.explanation || '',
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : undefined,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
      };
    } else {
      // 验证失败响应
      return {
        success: false,
        error: parsed.error || '无法理解查询意图',
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : ['请尝试更具体的描述'],
      };
    }
  } catch (e) {
    console.error('[Search NL Parse] Failed to parse AI response:', e);
    return {
      success: false,
      error: 'AI 响应解析失败',
      suggestions: ['请重试或使用手动配置模式'],
    };
  }
}

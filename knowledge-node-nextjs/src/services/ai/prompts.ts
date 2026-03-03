/**
 * Prompt 集中管理模块
 * 统一管理所有 AI 功能的 Prompt 模板
 */

import type { CommandTemplate, FieldDefinition, AIFieldConfig, AIFieldPresetType } from '@/types';

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
// 指令模板库
// ============================================================================

/**
 * 预设指令模板库
 * 分类：productivity（生产力）、analysis（分析）、creative（创意）、summary（摘要）
 */
export const COMMAND_TEMPLATES: CommandTemplate[] = [
  // ===== 生产力类 =====
  {
    id: 'weekly-report',
    name: '周报生成器',
    description: '根据本周记录自动生成周报，包含完成情况、进展和下周计划',
    prompt: `请根据以下本周的记录，生成一份结构化的周报。

## 本周记录
{{context}}

## 周报格式要求
1. **本周完成**：列出已完成的主要任务和成果
2. **进行中**：正在进行但未完成的工作
3. **遇到的问题**：遇到的困难或阻碍
4. **下周计划**：下周的主要工作安排
5. **总结**：用一两句话概括本周整体情况

请使用清晰的层级结构，重点突出关键成果和数据。`,
    icon: '📊',
    category: 'productivity',
    suggestedFilter: {
      dateRange: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date(),
      },
    },
  },
  {
    id: 'meeting-notes',
    name: '会议纪要整理',
    description: '将会议记录整理为结构化纪要，提取关键决策和待办事项',
    prompt: `请将以下会议记录整理为结构化的会议纪要。

## 会议记录
{{context}}

## 纪要格式要求
1. **会议主题**：一句话概括会议主要议题
2. **参会人员**：如果记录中提到的话
3. **讨论要点**：按议题分类整理讨论内容
4. **关键决策**：明确列出达成的决定
5. **待办事项**：列出任务、负责人和截止日期
6. **下次会议**：如果有安排的话

请确保纪要简洁清晰，重点突出可执行项。`,
    icon: '📝',
    category: 'productivity',
  },
  {
    id: 'task-breakdown',
    name: '任务拆解',
    description: '将大任务拆解为可执行的小步骤，包含时间估算',
    prompt: `请帮我将以下任务拆解为具体可执行的步骤。

## 任务描述
{{context}}

## 拆解要求
1. 将任务分解为 5-10 个具体步骤
2. 每个步骤应该是可在 1-2 小时内完成的单元
3. 按照合理的执行顺序排列
4. 为每个步骤估算大致时间
5. 标注步骤之间的依赖关系
6. 列出可能需要的资源或工具

请使用清单格式输出，方便直接作为待办事项使用。`,
    icon: '📋',
    category: 'productivity',
  },
  {
    id: 'daily-summary',
    name: '日报生成',
    description: '根据今日记录生成简洁的日报',
    prompt: `请根据以下今日的记录，生成一份简洁的日报。

## 今日记录
{{context}}

## 日报格式
1. **今日完成**：列出主要完成的工作
2. **明日计划**：列出明天的主要任务
3. **备注**：需要关注的问题或信息

保持简洁，每项不超过 5 条。`,
    icon: '📅',
    category: 'productivity',
  },

  // ===== 分析类 =====
  {
    id: 'content-summary',
    name: '内容摘要',
    description: '提取长文本的核心要点，生成简洁摘要',
    prompt: `请阅读以下内容并生成一份结构化摘要。

## 原文内容
{{context}}

## 摘要要求
1. **核心观点**：用 2-3 句话概括主旨
2. **关键要点**：列出 3-5 个最重要的观点
3. **重要数据**：如有具体数据或案例，请提取
4. **结论/建议**：如有明确结论，请总结

请保持摘要简洁，突出最有价值的信息。`,
    icon: '📖',
    category: 'summary',
  },
  {
    id: 'insight-extraction',
    name: '洞察提取',
    description: '从笔记中提取隐藏的模式、关联和洞察',
    prompt: `请分析以下笔记内容，提取有价值的洞察和模式。

## 笔记内容
{{context}}

## 分析维度
1. **主题聚类**：这些内容涉及哪些主要主题？
2. **模式识别**：是否存在重复出现的模式或趋势？
3. **关联发现**：不同主题之间有什么潜在联系？
4. **问题识别**：内容中反映出哪些问题或挑战？
5. **机会发现**：基于这些内容，可能存在哪些机会？
6. **行动建议**：基于分析，有什么建议的下一步行动？

请深入分析，提供有建设性的洞察。`,
    icon: '💡',
    category: 'analysis',
  },
  {
    id: 'review-reflect',
    name: '复盘反思',
    description: '对项目或经历进行复盘，提炼经验教训',
    prompt: `请帮我对以下经历/项目进行复盘分析。

## 复盘内容
{{context}}

## 复盘框架
1. **目标回顾**：最初的目标是什么？
2. **结果评估**：实际达成了什么？与目标的差距如何？
3. **成功因素**：哪些做法是有效的？为什么？
4. **失败原因**：哪些方面不够理想？根本原因是什么？
5. **意外发现**：有什么超出预期的收获或问题？
6. **经验教训**：学到了什么？下次如何改进？
7. **行动计划**：基于复盘，接下来具体要做什么？

请进行客观深入的分析，重点关注可复制的经验和可避免的教训。`,
    icon: '🔄',
    category: 'analysis',
  },
  {
    id: 'question-generator',
    name: '问题生成器',
    description: '基于内容生成深度思考问题，促进学习和反思',
    prompt: `请基于以下内容，生成有价值的思考问题。

## 内容
{{context}}

## 问题类型
1. **理解性问题**：帮助确认对内容的理解
2. **分析性问题**：促进深入思考和分析
3. **应用性问题**：思考如何应用到实际
4. **评价性问题**：引导进行评判和反思
5. **创造性问题**：激发新的想法和可能性

请生成 5-10 个高质量问题，按难度或类型分组。`,
    icon: '❓',
    category: 'analysis',
  },

  // ===== 创意类 =====
  {
    id: 'brainstorm',
    name: '头脑风暴',
    description: '围绕主题进行发散思考，生成创意想法',
    prompt: `请围绕以下主题进行头脑风暴，生成创意想法。

## 主题/问题
{{context}}

## 创意要求
请从以下角度生成想法：
1. **常规解决方案**：传统、稳妥的 3-5 个方案
2. **创新方案**：打破常规的 3-5 个新颖想法
3. **极端方案**：如果没有任何限制，最大胆的想法是什么？
4. **组合方案**：将不同想法组合可能产生什么？
5. **反向思考**：如果目标相反，会怎么做？

请尽量发散思维，不要自我限制，先追求数量再考虑质量。`,
    icon: '🧠',
    category: 'creative',
  },
  {
    id: 'story-expand',
    name: '内容扩展',
    description: '将简短的想法或大纲扩展为完整内容',
    prompt: `请将以下大纲或想法扩展为更完整的内容。

## 原始内容
{{context}}

## 扩展要求
1. 保持原有的核心观点和结构
2. 增加细节、例子和解释
3. 确保逻辑流畅，前后连贯
4. 适当增加过渡语句
5. 如果是观点，增加论据支持
6. 如果是故事，增加场景描写和对话

请保持原作者的风格和意图，自然地扩展内容。`,
    icon: '✨',
    category: 'creative',
  },
  {
    id: 'writing-polish',
    name: '文案润色',
    description: '优化文案的表达，提升文字质量',
    prompt: `请帮我润色以下文案，提升表达质量。

## 原文
{{context}}

## 润色要求
1. **清晰度**：消除歧义，使表达更准确
2. **简洁性**：删除冗余，使文字更精炼
3. **流畅性**：优化句式，使阅读更顺畅
4. **吸引力**：适当增加感染力和可读性
5. **专业性**：确保用词准确得体

请在保持原意的基础上进行优化，并简要说明主要改动点。`,
    icon: '✏️',
    category: 'creative',
  },
  {
    id: 'title-generator',
    name: '标题生成',
    description: '为内容生成吸引人的标题',
    prompt: `请为以下内容生成标题。

## 内容
{{context}}

## 要求
请生成 5 个不同风格的标题：
1. **简洁直接型**：直接说明主题
2. **悬念吸引型**：引发好奇心
3. **数字列表型**：如"5个方法..."
4. **问题引导型**：以问题形式
5. **情感共鸣型**：触动情感

每个标题控制在 20 字以内。`,
    icon: '🏷️',
    category: 'creative',
  },
];

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 根据分类获取模板
 */
export function getTemplatesByCategory(
  category: CommandTemplate['category']
): CommandTemplate[] {
  return COMMAND_TEMPLATES.filter((t) => t.category === category);
}

/**
 * 根据 ID 获取模板
 */
export function getTemplateById(id: string): CommandTemplate | undefined {
  return COMMAND_TEMPLATES.find((t) => t.id === id);
}

/**
 * 获取所有分类
 */
export function getTemplateCategories(): Array<{
  id: CommandTemplate['category'];
  name: string;
  icon: string;
  description: string;
}> {
  return [
    { id: 'productivity', name: '生产力', icon: '⚡', description: '提升工作效率' },
    { id: 'analysis', name: '分析', icon: '📊', description: '深入分析内容' },
    { id: 'creative', name: '创意', icon: '💡', description: '激发创造力' },
    { id: 'summary', name: '摘要', icon: '📝', description: '提炼核心信息' },
  ];
}

/**
 * 搜索模板
 */
export function searchTemplates(query: string): CommandTemplate[] {
  const lowerQuery = query.toLowerCase();
  return COMMAND_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery)
  );
}

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
  category?: CommandTemplate['category'];
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
// ============================================================================
// AI Schema 生成 Prompt
// ============================================================================

/**
 * Schema 生成系统 Prompt
 * 用于根据标签名称自动生成字段定义
 */
export const SCHEMA_GENERATION_SYSTEM_PROMPT = `你是一个专业的数据建模助手，擅长根据概念名称设计合理的字段结构。

你的任务是：
1. 分析用户提供的标签名称
2. 推断这类对象通常需要记录的属性
3. 生成合理的字段定义列表

## 设计原则
- 字段数量控制在 3-6 个，精简实用
- 优先考虑最常用、最有价值的属性
- 字段名称使用中文，简洁明了
- 字段 key 使用英文小写和下划线
- 选择最合适的字段类型

## 字段类型说明
- text: 文本类型，适用于名称、描述、备注等
- number: 数字类型，适用于数量、金额、评分等
- date: 日期类型，适用于时间、截止日期等
- select: 单选类型，适用于状态、优先级、分类等（需要提供选项列表）

## 输出要求
只返回 JSON，不要添加任何解释或 markdown 代码块标记。`;

/**
 * Schema 生成请求参数
 */
export interface SchemaGenerateParams {
  /** 标签名称 */
  tagName: string;
  /** 标签描述 */
  tagDescription?: string;
  /** 已有字段名称列表（避免重复） */
  existingFields?: string[];
}

/**
 * 构建 Schema 生成 Prompt
 */
export function buildSchemaGeneratePrompt(params: SchemaGenerateParams): string {
  const { tagName, tagDescription, existingFields } = params;
  
  let prompt = `## 标签信息
名称：${tagName}`;

  if (tagDescription) {
    prompt += `\n描述：${tagDescription}`;
  }
  
  if (existingFields && existingFields.length > 0) {
    prompt += `\n\n## 已有字段
请避免与以下已有字段重复：
${existingFields.map(f => `- ${f}`).join('\n')}`;
  }
  
  prompt += `

## 输出格式
请返回以下 JSON 格式（不要包含 markdown 代码块）：
{
  "fields": [
    {
      "name": "字段中文名",
      "key": "field_key",
      "type": "text|number|date|select",
      "options": ["选项1", "选项2"]  // 仅 select 类型需要
    }
  ],
  "reasoning": "设计思路简述"
}

## 示例

如果标签是"书籍"，可能生成：
{
  "fields": [
    { "name": "作者", "key": "author", "type": "text" },
    { "name": "评分", "key": "rating", "type": "number" },
    { "name": "阅读状态", "key": "status", "type": "select", "options": ["想读", "在读", "已读"] },
    { "name": "开始日期", "key": "start_date", "type": "date" }
  ],
  "reasoning": "书籍通常需要记录作者信息、个人评分、阅读进度和时间"
}

如果标签是"电影"，可能生成：
{
  "fields": [
    { "name": "导演", "key": "director", "type": "text" },
    { "name": "评分", "key": "rating", "type": "number" },
    { "name": "观看日期", "key": "watch_date", "type": "date" },
    { "name": "类型", "key": "genre", "type": "select", "options": ["动作", "喜剧", "剧情", "科幻", "恐怖"] }
  ],
  "reasoning": "电影记录通常包含创作者、个人评价和观看时间"
}`;

  return prompt;
}

/**
 * Schema 生成响应
 */
export interface SchemaGenerateResponse {
  fields: Array<{
    name: string;
    key: string;
    type: 'text' | 'number' | 'date' | 'select';
    options?: string[];
  }>;
  reasoning?: string;
}

/**
 * 解析 Schema 生成响应
 */
export function parseSchemaGenerateResponse(content: string): SchemaGenerateResponse {
  // 尝试清理可能的 markdown 代码块标记
  let cleaned = content.trim();
  
  // 移除 ```json 和 ``` 标记
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  
  const parsed = JSON.parse(cleaned);
  
  // 验证并规范化字段
  const fields = (parsed.fields || []).map((f: Record<string, unknown>) => {
    const field: SchemaGenerateResponse['fields'][0] = {
      name: String(f.name || ''),
      key: String(f.key || f.name || '').toLowerCase().replace(/\s+/g, '_'),
      type: (['text', 'number', 'date', 'select'].includes(String(f.type)) 
        ? String(f.type) as 'text' | 'number' | 'date' | 'select'
        : 'text'),
    };
    
    if (field.type === 'select' && Array.isArray(f.options)) {
      field.options = f.options.map(String);
    }
    
    return field;
  }).filter((f: SchemaGenerateResponse['fields'][0]) => f.name && f.key);
  
  return {
    fields,
    reasoning: parsed.reasoning,
  };
}

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
// AI 字段 Prompt 模块
// v3.4: 新增 AI 智能字段的 Prompt 模板
// ============================================================================

/**
 * AI 字段系统 Prompt
 */
export const AI_FIELD_PROMPTS = {
  /** AI 字段处理系统角色 */
  SYSTEM: `你是一个智能任务分析助手，专门帮助用户分析任务内容并生成结构化数据。

你的职责是：
1. 分析任务的描述内容
2. 根据指定的字段类型输出正确格式的结果
3. 保持输出简洁、准确、可执行

输出规则：
- 只返回请求的数据，不要添加额外解释
- 严格按照指定的格式输出
- 如果无法判断，使用合理的默认值`,

  /** 紧急度评分 Prompt */
  URGENCY_SCORE: `请分析以下任务内容，评估其紧急程度并返回优先级评分。

## 任务内容
{{content}}

## 上下文字段
{{contextFields}}

## 评分标准
- P0：紧急且重要，需要立即处理（如：今天截止、严重bug、阻塞性问题）
- P1：重要但不紧急，需要近期处理（如：本周截止、重要功能开发）
- P2：常规任务，正常排期处理（如：日常工作、优化改进）
- P3：低优先级，可以延后处理（如：锦上添花、长期规划）

## 判断依据
1. 是否有明确截止日期？距离截止日期多远？
2. 内容中是否包含"紧急"、"立即"、"尽快"等关键词？
3. 是否涉及阻塞性问题或重要客户？
4. 任务的影响范围和重要性如何？

请只返回优先级标签（P0/P1/P2/P3），不要添加任何其他内容。`,

  /** 子任务拆解 Prompt */
  SUBTASK_SPLIT: `请分析以下任务内容，将其拆解为可执行的子任务列表。

## 任务内容
{{content}}

## 拆解要求
1. 将任务分解为 3-7 个具体子任务
2. 每个子任务应该是可在 1-2 小时内完成的单元
3. 子任务应该按照合理的执行顺序排列
4. 每个子任务描述应简洁明了（不超过 30 字）

## 输出格式
请以 JSON 数组格式返回子任务列表：
["子任务1", "子任务2", "子任务3"]

只返回 JSON 数组，不要包含 markdown 代码块或其他内容。`,

  /** 自定义字段 Prompt 模板 */
  CUSTOM: `请根据以下内容完成指定的分析任务。

## 内容
{{content}}

## 任务要求
{{customPrompt}}

## 上下文字段
{{contextFields}}

## 输出格式
{{outputFormat}}

请严格按照输出格式要求返回结果。`,
} as const;

/**
 * AI 字段 Prompt 构建参数
 */
export interface AIFieldPromptParams {
  /** AI 字段预设类型 */
  aiType: AIFieldPresetType;
  /** 节点内容 */
  nodeContent: string;
  /** 字段定义 */
  fieldDef: FieldDefinition;
  /** 现有字段值 */
  existingFields?: Record<string, unknown>;
  /** 自定义 Prompt（仅 custom 类型） */
  customPrompt?: string;
}

/**
 * 构建 AI 字段 Prompt
 */
export function buildAIFieldPrompt(params: AIFieldPromptParams): string {
  const { aiType, nodeContent, fieldDef, existingFields = {}, customPrompt } = params;

  // 格式化上下文字段
  const contextFieldsStr = Object.entries(existingFields)
    .filter(([_, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
    .join('\n') || '无';

  // 根据类型选择 Prompt 模板
  switch (aiType) {
    case 'urgency_score':
      return AI_FIELD_PROMPTS.URGENCY_SCORE
        .replace('{{content}}', nodeContent)
        .replace('{{contextFields}}', contextFieldsStr);

    case 'subtask_split':
      return AI_FIELD_PROMPTS.SUBTASK_SPLIT
        .replace('{{content}}', nodeContent);

    case 'custom':
      // 确定输出格式说明
      let outputFormatStr = '';
      const aiConfig = fieldDef.aiConfig;
      if (aiConfig) {
        switch (aiConfig.outputFormat) {
          case 'select':
            outputFormatStr = `请从以下选项中选择一个返回：${aiConfig.options?.join('、') || ''}`;
            break;
          case 'list':
            outputFormatStr = '请以 JSON 数组格式返回：["项目1", "项目2", ...]';
            break;
          case 'text':
          default:
            outputFormatStr = '请直接返回文本内容，不要添加额外格式。';
        }
      }

      return AI_FIELD_PROMPTS.CUSTOM
        .replace('{{content}}', nodeContent)
        .replace('{{customPrompt}}', customPrompt || '请分析内容并给出合理的结果')
        .replace('{{contextFields}}', contextFieldsStr)
        .replace('{{outputFormat}}', outputFormatStr);

    default:
      throw new Error(`不支持的 AI 字段类型: ${aiType}`);
  }
}

/**
 * 解析 AI 字段响应
 */
export function parseAIFieldResponse(
  content: string,
  aiConfig: AIFieldConfig
): string | string[] | null {
  // 清理响应内容
  let cleaned = content.trim();

  // 移除可能的 markdown 代码块标记
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  // 根据输出格式解析
  switch (aiConfig.outputFormat) {
    case 'select':
      // 验证是否在选项列表中
      if (aiConfig.options && aiConfig.options.length > 0) {
        // 尝试精确匹配
        const exactMatch = aiConfig.options.find(
          (opt) => opt.toLowerCase() === cleaned.toLowerCase()
        );
        if (exactMatch) return exactMatch;

        // 尝试包含匹配
        const containsMatch = aiConfig.options.find((opt) =>
          cleaned.toLowerCase().includes(opt.toLowerCase())
        );
        if (containsMatch) return containsMatch;

        // 无法匹配，返回第一个选项作为默认值
        console.warn(`[AI Field] 无法匹配选项，使用默认值: ${aiConfig.options[0]}`);
        return aiConfig.options[0];
      }
      return cleaned;

    case 'list':
      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          return parsed.map(String).filter(Boolean);
        }
        // 如果不是数组，尝试按换行拆分
        return cleaned.split('\n').map((s) => s.trim()).filter(Boolean);
      } catch {
        // JSON 解析失败，按换行拆分
        return cleaned
          .split('\n')
          .map((s) => s.replace(/^[-\d.)\]]+\s*/, '').trim())
          .filter(Boolean);
      }

    case 'text':
    default:
      return cleaned;
  }
}

/**
 * 获取 AI 字段默认值
 */
export function getAIFieldDefaultValue(aiConfig: AIFieldConfig): unknown {
  switch (aiConfig.outputFormat) {
    case 'select':
      return aiConfig.options?.[aiConfig.options.length - 1] || null; // 默认最低优先级
    case 'list':
      return [];
    case 'text':
    default:
      return '';
  }
}

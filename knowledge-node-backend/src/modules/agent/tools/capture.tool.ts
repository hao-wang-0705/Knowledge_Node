/**
 * 快速捕获工具
 * 用于多模态快速捕获功能的 AI 结构化处理
 */

import { BaseTool } from './base.tool';
import { ToolInput, ToolOutput, ToolCategory, ExecutionContext } from '../interfaces';

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

export interface CaptureInput extends ToolInput {
  /** 文本输入 */
  text?: string;
  /** 图片数量 */
  imageCount?: number;
  /** 语音转写文本 */
  voiceTranscription?: string;
  /** 用户手动指定的标签 ID */
  manualTagId?: string;
  /** 可用的 Supertag Schema 列表 */
  supertags: SupertagSchema[];
}

export interface CaptureStructuredResponse {
  content: string;
  supertagId: string | null;
  fields: Record<string, unknown>;
  confidence: number;
  alternativeTags?: string[];
}

const CAPTURE_SYSTEM_PROMPT = `你是一个智能知识助手，专门帮助用户快速记录和结构化笔记。

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

export class CaptureTool extends BaseTool<CaptureInput, ToolOutput> {
  readonly name = 'capture';
  readonly description = '快速捕获工具，将用户输入（文本/图片/语音）结构化为节点，匹配标签并提取字段';
  readonly category: ToolCategory = 'extraction';
  readonly requiresContext = false;

  readonly inputSchema = {
    type: 'object',
    properties: {
      text: { type: 'string', description: '文本输入' },
      imageCount: { type: 'number', description: '图片数量' },
      voiceTranscription: { type: 'string', description: '语音转写文本' },
      manualTagId: { type: 'string', description: '用户手动指定的标签 ID' },
      supertags: {
        type: 'array',
        description: '可用的 Supertag Schema 列表',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            icon: { type: 'string' },
            description: { type: 'string' },
            fields: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  name: { type: 'string' },
                  type: { type: 'string' },
                  options: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    },
    required: ['supertags'],
  };

  async *execute(input: CaptureInput, context: ExecutionContext): AsyncGenerator<ToolOutput> {
    const client = this.getClient();
    const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

    try {
      yield this.createMetadata({ model, startTime: Date.now() });

      const userPrompt = this.buildUserPrompt(input);

      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: CAPTURE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1024,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '';

      // 解析并验证响应
      const parsed = this.parseResponse(content);

      yield this.createComplete(JSON.stringify(parsed), {
        tokensUsed: response.usage?.total_tokens,
        model,
      });
    } catch (error) {
      yield this.createError(
        error instanceof Error ? error.message : '快速捕获处理失败'
      );
    }
  }

  private buildUserPrompt(input: CaptureInput): string {
    const { text, imageCount, voiceTranscription, manualTagId, supertags } = input;

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

    const tagList = supertags.map((tag) => {
      const fieldsDesc = tag.fields
        .map((f) => `${f.name}(${f.key}): ${f.type}${f.options ? `, 选项: ${f.options.join('/')}` : ''}`)
        .join('; ');
      return `- ${tag.icon || '📌'} ${tag.name} (ID: ${tag.id})${tag.description ? `: ${tag.description}` : ''}\n  字段: ${fieldsDesc || '无'}`;
    }).join('\n');

    const today = new Date();
    const dateContext = `今天是 ${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日，星期${['日', '一', '二', '三', '四', '五', '六'][today.getDay()]}`;

    let prompt = `## 用户输入
${inputParts.join('\n\n')}

## 日期上下文
${dateContext}

## 可用标签列表
${tagList || '暂无标签'}`;

    if (manualTagId) {
      const manualTag = supertags.find((t) => t.id === manualTagId);
      if (manualTag) {
        prompt += `\n\n## 用户指定标签
用户已手动选择标签：${manualTag.icon || '📌'} ${manualTag.name} (ID: ${manualTagId})
请使用此标签并提取相应字段。`;
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

  private parseResponse(content: string): CaptureStructuredResponse {
    let cleaned = content.trim();

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
      return {
        content: content,
        supertagId: null,
        fields: {},
        confidence: 0,
      };
    }
  }
}

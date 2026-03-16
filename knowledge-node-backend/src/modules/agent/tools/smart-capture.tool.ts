/**
 * 智能捕获工具
 * 合并"文本格式化整理"与"意图及标签预测"能力，支持流式输出
 */

import { BaseTool } from './base.tool';
import { ToolInput, ToolOutput, ToolCategory, ExecutionContext } from '../interfaces';

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

export interface SmartCaptureInput extends ToolInput {
  /** 用户输入的文本 */
  text: string;
  /** 可用的 Supertag Schema 列表 */
  supertags: SmartCaptureTagSchema[];
}

export interface SmartCaptureNode {
  tempId: string;
  content: string;
  parentTempId: string | null;
  supertagId: string | null;
  fields: Record<string, unknown>;
  confidence: number;
  isAIExtracted: boolean;
}

const SMART_CAPTURE_SYSTEM_PROMPT = `你是一个专业的知识管理助手，擅长将非结构化文字整理为结构化知识节点。

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
- 不要添加 markdown 代码块标记，直接返回 JSON`;

export class SmartCaptureTool extends BaseTool<SmartCaptureInput, ToolOutput> {
  readonly name = 'smart_capture';
  readonly description = '智能捕获工具，将文本整理为树形节点结构，同时匹配标签和提取字段，支持流式输出';
  readonly category: ToolCategory = 'extraction';
  readonly requiresContext = false;

  readonly inputSchema = {
    type: 'object',
    properties: {
      text: { type: 'string', description: '用户输入的文本' },
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
    required: ['text', 'supertags'],
  };

  async *execute(input: SmartCaptureInput, context: ExecutionContext): AsyncGenerator<ToolOutput> {
    const client = this.getClient();
    const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

    try {
      yield this.createMetadata({ model, startTime: Date.now() });

      const userPrompt = this.buildUserPrompt(input);

      // 使用流式输出
      const stream = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: SMART_CAPTURE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 2048,
        temperature: 0.3,
        stream: true,
      });

      let fullContent = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          yield this.createChunk(content);
        }
      }

      // 解析并验证响应
      const parsed = this.parseResponse(fullContent);

      yield this.createComplete(JSON.stringify(parsed), {
        tokensUsed: fullContent.length / 2,
        model,
      });
    } catch (error) {
      yield this.createError(
        error instanceof Error ? error.message : '智能捕获处理失败'
      );
    }
  }

  private buildUserPrompt(input: SmartCaptureInput): string {
    const { text, supertags } = input;

    const today = new Date();
    const dateContext = `今天是 ${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日，星期${['日', '一', '二', '三', '四', '五', '六'][today.getDay()]}`;

    const tagList = supertags.map((tag) => {
      const fieldsDesc = tag.fields
        .map((f) => `${f.name}(${f.key}): ${f.type}${f.options ? `, 选项: ${f.options.join('/')}` : ''}`)
        .join('; ');
      return `- ${tag.icon || '📌'} ${tag.name} (ID: ${tag.id})${tag.description ? `: ${tag.description}` : ''}\n  字段: ${fieldsDesc || '无'}`;
    }).join('\n');

    return `## 日期上下文
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

  private parseResponse(content: string): SmartCaptureNode[] {
    let cleaned = content.trim();

    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    try {
      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed)) {
        return [{
          tempId: '1',
          content: content,
          parentTempId: null,
          supertagId: null,
          fields: {},
          confidence: 0,
          isAIExtracted: true,
        }];
      }

      return parsed.map((node: Record<string, unknown>, index: number) => ({
        tempId: String(node.tempId || index + 1),
        content: String(node.content || ''),
        parentTempId: node.parentTempId ? String(node.parentTempId) : null,
        supertagId: node.supertagId ? String(node.supertagId) : null,
        fields: (node.fields as Record<string, unknown>) || {},
        confidence: typeof node.confidence === 'number' ? node.confidence : 0.8,
        isAIExtracted: true,
      }));
    } catch (e) {
      return [{
        tempId: '1',
        content: content,
        parentTempId: null,
        supertagId: null,
        fields: {},
        confidence: 0,
        isAIExtracted: true,
      }];
    }
  }
}

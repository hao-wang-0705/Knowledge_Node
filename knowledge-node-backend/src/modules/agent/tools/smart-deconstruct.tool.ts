/**
 * 智能解构工具
 * 将节点长文本解构为层级化子节点树 + 属性资产（超级标签与字段预填），与 SmartCaptureTool 共享 Schema 与解析逻辑
 * 仅返回建议节点树，不写库，由前端幽灵预览后用户确认再写入
 */

import { BaseTool } from './base.tool';
import { ToolInput, ToolOutput, ToolCategory, ExecutionContext } from '../interfaces';
import type { SmartCaptureTagSchema, SmartCaptureNode } from './smart-capture.tool';

export interface SmartDeconstructInput extends ToolInput {
  /** 当前被解构的节点 ID（可选，用于幂等与调试） */
  nodeId?: string;
  /** 节点当前内容 */
  text: string;
  /** 可用的 Supertag Schema 列表，与 SmartCapture 一致 */
  supertags: SmartCaptureTagSchema[];
}

const SMART_DECONSTRUCT_SYSTEM_PROMPT = `你是一个专业的知识管理助手，擅长将长文本解构为层次清晰的结构化节点树。

核心任务（与智能捕获一致，但强调层级与不篡改原文）：
1. **不得修改原文**：仅输出解构后的节点树建议，不要改写、总结或删减用户原始表述。
2. **层级资产**：识别文本的从属关系。将长篇内容提炼出一个「父节点」作为摘要/标题，将具体论据、疑问、灵感、任务拆解为「子节点」，最多 3 层嵌套。
3. **属性资产**：为每个原子节点做意图识别，从提供的标签列表中匹配超级标签，并对标签关联字段进行解析与预填。

## 标签匹配规则
- 单标签策略：每个节点仅匹配置信度最高的一个标签
- 置信度阈值 > 0.8：低于时 supertagId 设为 null
- 不要强制匹配，普通笔记内容可不挂载标签

## 字段提取规则
- 日期转为 YYYY-MM-DD；优先级、状态、参与人等从内容中提取
- 字段类型校验失败时留空，不强行填充

## 输出规则
- 必须输出 JSON 数组，按深度优先排列
- 每个节点：tempId、content、parentTempId、supertagId、fields、confidence、isAIExtracted
- 根节点 parentTempId 为 null，父节点在子节点之前
- 不要添加 markdown 代码块标记，直接返回 JSON`;

export class SmartDeconstructTool extends BaseTool<SmartDeconstructInput, ToolOutput> {
  readonly name = 'smart_deconstruct';
  readonly description = '智能解构工具，将节点长文本拆成层级化子节点树并挂载超级标签与字段，仅返回建议树不写库';
  readonly category: ToolCategory = 'extraction';
  readonly requiresContext = false;

  readonly inputSchema = {
    type: 'object',
    properties: {
      nodeId: { type: 'string', description: '当前被解构的节点 ID' },
      text: { type: 'string', description: '节点当前内容' },
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

  async *execute(input: SmartDeconstructInput, _context: ExecutionContext): AsyncGenerator<ToolOutput> {
    const client = this.getClient();
    const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

    try {
      yield this.createMetadata({ model, startTime: Date.now(), nodeId: input.nodeId });

      const userPrompt = this.buildUserPrompt(input);

      const stream = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: SMART_DECONSTRUCT_SYSTEM_PROMPT },
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

      const parsed = this.parseResponse(fullContent);

      yield this.createComplete(JSON.stringify(parsed), {
        tokensUsed: fullContent.length / 2,
        model,
      });
    } catch (error) {
      yield this.createError(
        error instanceof Error ? error.message : '智能解构处理失败'
      );
    }
  }

  private buildUserPrompt(input: SmartDeconstructInput): string {
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

## 待解构的节点内容（不要修改原文，仅输出解构后的节点树）
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
    } catch {
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

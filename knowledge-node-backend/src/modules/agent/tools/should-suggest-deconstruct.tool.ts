/**
 * 是否建议解构 Tool
 * 判断节点内容是否适合被解构为多节点结构，供前端在悬浮时决定是否展示「解构」入口
 */

import { BaseTool } from './base.tool';
import { ToolInput, ToolOutput, ToolCategory, ExecutionContext } from '../interfaces';

export interface ShouldSuggestDeconstructInput extends ToolInput {
  content: string;
}

const SYSTEM_PROMPT = `你是一个知识管理助手。你的任务只有一项：判断「用户给出的一段文本」是否适合被解构为多节点结构（即拆成多个有层级、有主题的子节点）。

适合解构的典型情况：多主题、多要点、会议记录、待办列表、层次清晰的长文、脑暴多条想法。
不适合解构的典型情况：单一金句、诗歌、代码块、已结构化的一两句话、纯标题。

只输出一个 JSON 对象，不要任何其他文字或 markdown 标记。格式固定为：{"suggest": true} 或 {"suggest": false}`;

export class ShouldSuggestDeconstructTool extends BaseTool<ShouldSuggestDeconstructInput, ToolOutput> {
  readonly name = 'should_suggest_deconstruct';
  readonly description = '判断一段文本是否适合被解构为多节点结构，返回 suggest 布尔值';
  readonly category: ToolCategory = 'analysis';
  readonly requiresContext = false;

  readonly inputSchema = {
    type: 'object',
    properties: {
      content: { type: 'string', description: '节点正文内容' },
    },
    required: ['content'],
  };

  async *execute(input: ShouldSuggestDeconstructInput, _context: ExecutionContext): AsyncGenerator<ToolOutput> {
    const client = this.getClient();
    const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const content = (input.content ?? '').trim();
    if (!content) {
      yield this.createComplete(JSON.stringify({ suggest: false }), {});
      return;
    }

    try {
      yield this.createMetadata({ model, startTime: Date.now() });

      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `请判断以下内容是否适合解构为多节点结构：\n\n${content.slice(0, 3000)}` },
        ],
        max_tokens: 64,
        temperature: 0.1,
        stream: false,
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? '';
      const suggest = this.parseSuggest(raw);

      yield this.createComplete(JSON.stringify({ suggest }), {
        tokensUsed: raw.length / 2,
        model,
      });
    } catch (error) {
      yield this.createComplete(JSON.stringify({ suggest: false }), {
        error: error instanceof Error ? error.message : '判断失败',
      });
    }
  }

  private parseSuggest(raw: string): boolean {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    try {
      const obj = JSON.parse(cleaned) as { suggest?: boolean };
      return obj.suggest === true;
    } catch {
      if (/suggest\s*:\s*true/i.test(cleaned) || /"suggest"\s*:\s*true/.test(cleaned)) return true;
      return false;
    }
  }
}

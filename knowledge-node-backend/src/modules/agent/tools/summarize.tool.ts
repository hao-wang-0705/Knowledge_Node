/**
 * 总结工具
 * 对文本内容进行总结归纳
 */

import { BaseTool } from './base.tool';
import { ToolInput, ToolOutput, ToolCategory, ExecutionContext } from '../interfaces';

export interface SummarizeInput extends ToolInput {
  content?: string;
  style?: 'brief' | 'detailed' | 'bullet';
  maxLength?: number;
}

export class SummarizeTool extends BaseTool<SummarizeInput, ToolOutput> {
  readonly name = 'summarize';
  readonly description = '内容总结工具，对文本进行归纳总结、提取要点，支持简洁摘要、详细总结和要点列表等风格';
  readonly category: ToolCategory = 'summary';
  readonly requiresContext = true;

  readonly inputSchema = {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: '需要总结的内容（如不提供则使用上下文节点）',
      },
      style: {
        type: 'string',
        enum: ['brief', 'detailed', 'bullet'],
        description: '总结风格：brief简洁、detailed详细、bullet要点',
        default: 'brief',
      },
      maxLength: {
        type: 'number',
        description: '总结最大长度（字数）',
        default: 500,
      },
    },
    required: [],
  };

  async *execute(input: SummarizeInput, context: ExecutionContext): AsyncGenerator<ToolOutput> {
    const client = this.getClient();
    const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

    // 获取待总结的内容
    let contentToSummarize = input.content || '';
    
    if (!contentToSummarize && context.nodes && context.nodes.length > 0) {
      contentToSummarize = context.nodes
        .map((node, i) => `[${i + 1}] ${node.title}: ${node.content || ''}`)
        .join('\n\n');
    }

    if (!contentToSummarize) {
      yield this.createError('没有可总结的内容');
      return;
    }

    // 根据风格构建系统提示词
    const stylePrompts = {
      brief: `请用简洁的语言总结以下内容，控制在${input.maxLength || 500}字以内。
输出要求：
1. 严禁使用Markdown格式标记
2. 直接输出核心内容
3. 每个要点独立成段`,
      detailed: `请对以下内容进行详细总结，包含主要观点和支撑细节。
输出要求：
1. 严禁使用Markdown格式标记
2. 按逻辑结构组织内容
3. 保留关键细节和数据`,
      bullet: `请从以下内容中提取核心要点。
输出要求：
1. 每个要点独立成段
2. 严禁使用任何列表符号（-、*、•等）
3. 直接输出要点内容`,
    };

    const systemPrompt = stylePrompts[input.style || 'brief'];

    try {
      yield this.createMetadata({
        model,
        style: input.style || 'brief',
        sourceLength: contentToSummarize.length,
        startTime: Date.now(),
      });

      const stream = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请总结以下内容：\n\n${contentToSummarize}` },
        ],
        max_tokens: input.maxLength ? Math.ceil(input.maxLength * 2) : 1024,
        temperature: 0.5,
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

      yield this.createComplete(fullContent, {
        style: input.style || 'brief',
        originalLength: contentToSummarize.length,
        summaryLength: fullContent.length,
      });
    } catch (error) {
      yield this.createError(
        error instanceof Error ? error.message : '总结生成失败'
      );
    }
  }
}

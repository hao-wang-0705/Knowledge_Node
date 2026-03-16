/**
 * 聚合分析工具
 * 用于固定视图中对多个节点进行聚合查询分析，支持流式输出
 */

import { BaseTool } from './base.tool';
import { ToolInput, ToolOutput, ToolCategory, ExecutionContext } from '../interfaces';

export interface AggregateInput extends ToolInput {
  /** 用户查询/问题 */
  query: string;
  /** 聚合模式 */
  mode?: 'summarize' | 'extract' | 'analyze' | 'custom';
  /** 输出格式要求 */
  outputFormat?: string;
}

const AGGREGATE_SYSTEM_PROMPT = `你是一个数据分析专家，擅长从多条记录中提取洞察和模式。

核心能力：
1. 聚合多条记录的关键信息
2. 识别趋势、模式和异常
3. 生成结构化的汇总报告
4. 回答用户关于数据的具体问题

分析原则：
1. 基于事实，避免主观臆断
2. 识别趋势和异常
3. 提供可操作的建议
4. 量化分析（如有数据）

输出格式：
- 摘要结论在前
- 详细分析在后
- 附带数据支撑（如适用）`;

export class AggregateTool extends BaseTool<AggregateInput, ToolOutput> {
  readonly name = 'aggregate';
  readonly description = '聚合分析工具，对多个节点进行聚合查询分析，支持总结、提取、分析等多种模式';
  readonly category: ToolCategory = 'analysis';
  readonly requiresContext = true;

  readonly inputSchema = {
    type: 'object',
    properties: {
      query: { type: 'string', description: '用户查询/问题' },
      mode: {
        type: 'string',
        enum: ['summarize', 'extract', 'analyze', 'custom'],
        description: '聚合模式',
      },
      outputFormat: { type: 'string', description: '输出格式要求' },
      prompt: { type: 'string', description: '用户原始指令' },
    },
    required: ['query'],
  };

  async *execute(input: AggregateInput, context: ExecutionContext): AsyncGenerator<ToolOutput> {
    const client = this.getClient();
    const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

    // 检查是否有节点数据
    if (!context.nodes || context.nodes.length === 0) {
      yield this.createError('没有可聚合的节点数据');
      return;
    }

    try {
      yield this.createMetadata({
        model,
        startTime: Date.now(),
        nodeCount: context.nodes.length,
      });

      const userPrompt = this.buildUserPrompt(input, context);

      // 使用流式输出
      const stream = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: AGGREGATE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 4096,
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
        tokensUsed: fullContent.length / 2,
        model,
        nodeCount: context.nodes.length,
      });
    } catch (error) {
      yield this.createError(
        error instanceof Error ? error.message : '聚合分析失败'
      );
    }
  }

  private buildUserPrompt(input: AggregateInput, context: ExecutionContext): string {
    const { query, mode = 'custom', outputFormat } = input;

    // 构建节点内容
    const nodesContent = context.nodes?.map((node, index) => {
      let content = `[${index + 1}] ${node.title}`;
      if (node.content) {
        content += `\n${node.content.substring(0, 1000)}`;
      }
      if (node.fields && Object.keys(node.fields).length > 0) {
        content += `\n字段: ${JSON.stringify(node.fields)}`;
      }
      return content;
    }).join('\n\n---\n\n') || '';

    let modeInstruction = '';
    switch (mode) {
      case 'summarize':
        modeInstruction = '请对以上所有内容进行总结，提炼核心要点。';
        break;
      case 'extract':
        modeInstruction = '请从以上内容中提取关键信息，按主题分类整理。';
        break;
      case 'analyze':
        modeInstruction = '请对以上内容进行深入分析，识别模式、趋势和洞察。';
        break;
      default:
        modeInstruction = query;
    }

    let prompt = `## 数据源（共 ${context.nodes?.length || 0} 条记录）

${nodesContent}

## 任务
${modeInstruction}`;

    if (outputFormat) {
      prompt += `\n\n## 输出格式要求\n${outputFormat}`;
    }

    return prompt;
  }
}

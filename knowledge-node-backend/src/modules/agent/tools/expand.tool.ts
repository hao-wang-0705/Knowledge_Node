/**
 * 内容扩展工具
 * 对简短内容进行扩写和详细化
 */

import { BaseTool } from './base.tool';
import { ToolInput, ToolOutput, ToolCategory, ExecutionContext } from '../interfaces';

export interface ExpandInput extends ToolInput {
  content?: string;
  targetLength?: number;
  focus?: string;
}

export class ExpandTool extends BaseTool<ExpandInput, ToolOutput> {
  readonly name = 'expand';
  readonly description = '内容扩展工具，将简短内容扩写为更详细、更专业的表述，支持指定扩展方向和目标长度';
  readonly category: ToolCategory = 'expansion';
  readonly requiresContext = true;

  readonly inputSchema = {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: '需要扩展的内容（如不提供则使用上下文节点）',
      },
      targetLength: {
        type: 'number',
        description: '目标长度（字数）',
        default: 300,
      },
      focus: {
        type: 'string',
        description: '扩展重点方向（如：技术细节、背景说明、实现步骤等）',
      },
    },
    required: [],
  };

  async *execute(input: ExpandInput, context: ExecutionContext): AsyncGenerator<ToolOutput> {
    const client = this.getClient();
    const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

    // 获取待扩展的内容
    let contentToExpand = input.content || '';
    
    if (!contentToExpand && context.nodes && context.nodes.length > 0) {
      contentToExpand = context.nodes[0].content || context.nodes[0].title;
    }

    if (!contentToExpand) {
      yield this.createError('没有可扩展的内容');
      return;
    }

    // 构建系统提示词
    let systemPrompt = `你是一个专业文案优化专家。请将用户提供的简短文本扩写为更加专业、结构清晰的完整表述。

输出要求：
1. 保持原意,但让表达更专业、更完整
2. 补充必要的背景和细节
3. 使用清晰的逻辑结构
4. 目标长度：${input.targetLength || 300}字左右
5. 严禁使用Markdown格式标记
6. 段落间用双换行分隔`;

    if (input.focus) {
      systemPrompt += `\n7. 重点方向：${input.focus}`;
    }

    try {
      yield this.createMetadata({
        model,
        originalLength: contentToExpand.length,
        targetLength: input.targetLength || 300,
        focus: input.focus,
        startTime: Date.now(),
      });

      const stream = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请扩写以下内容：\n\n${contentToExpand}` },
        ],
        max_tokens: (input.targetLength || 300) * 3,
        temperature: 0.7,
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
        originalLength: contentToExpand.length,
        expandedLength: fullContent.length,
        expansionRatio: (fullContent.length / contentToExpand.length).toFixed(2),
      });
    } catch (error) {
      yield this.createError(
        error instanceof Error ? error.message : '内容扩展失败'
      );
    }
  }
}

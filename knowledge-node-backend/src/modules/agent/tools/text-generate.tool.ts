/**
 * 文本生成工具
 * 核心文本生成能力，支持流式输出
 */

import { BaseTool } from './base.tool';
import { ToolInput, ToolOutput, ToolCategory, ExecutionContext } from '../interfaces';

export interface TextGenerateInput extends ToolInput {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export class TextGenerateTool extends BaseTool<TextGenerateInput, ToolOutput> {
  readonly name = 'text_generate';
  readonly description = '通用文本生成工具，根据用户指令和上下文生成文本内容，支持总结、分析、创作等多种场景';
  readonly category: ToolCategory = 'creative';
  readonly requiresContext = false;

  readonly inputSchema = {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: '用户指令或问题',
      },
      systemPrompt: {
        type: 'string',
        description: '系统提示词，用于指导AI行为',
      },
      maxTokens: {
        type: 'number',
        description: '最大生成token数',
        default: 2048,
      },
      temperature: {
        type: 'number',
        description: '生成温度，0-2之间',
        default: 0.7,
      },
    },
    required: ['prompt'],
  };

  async *execute(input: TextGenerateInput, context: ExecutionContext): AsyncGenerator<ToolOutput> {
    const client = this.getClient();
    const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

    // 构建系统提示词
    const systemPrompt = input.systemPrompt || this.buildSystemPrompt(context);

    // 构建用户消息
    let userMessage = input.prompt;
    if (context.nodes && context.nodes.length > 0) {
      userMessage += '\n\n相关上下文：\n';
      context.nodes.forEach((node, i) => {
        userMessage += `[${i + 1}] ${node.title}: ${node.content?.substring(0, 500) || ''}\n`;
      });
    }

    try {
      // 发送元数据
      yield this.createMetadata({
        model,
        startTime: Date.now(),
      });

      const stream = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: input.maxTokens || 2048,
        temperature: input.temperature || 0.7,
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
        tokensUsed: fullContent.length / 2, // 估算
        model,
      });
    } catch (error) {
      yield this.createError(
        error instanceof Error ? error.message : '文本生成失败'
      );
    }
  }
}

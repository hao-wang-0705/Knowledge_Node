/**
 * 联网搜索工具
 * 使用 Gemini Google Search grounding 进行实时网络搜索
 */

import { BaseTool } from './base.tool';
import { ToolInput, ToolOutput, ToolCategory, ExecutionContext } from '../interfaces';

export interface WebSearchInput extends ToolInput {
  query: string;
  maxResults?: number;
}

export class WebSearchTool extends BaseTool<WebSearchInput, ToolOutput> {
  readonly name = 'web_search';
  readonly description = '联网搜索工具，通过Google搜索获取实时信息、新闻动态、股价天气等时效性内容';
  readonly category: ToolCategory = 'search';
  readonly requiresContext = false;

  readonly inputSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索查询关键词',
      },
      maxResults: {
        type: 'number',
        description: '最大返回结果数',
        default: 5,
      },
    },
    required: ['query'],
  };

  async *execute(input: WebSearchInput, context: ExecutionContext): AsyncGenerator<ToolOutput> {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    
    if (!geminiApiKey) {
      yield this.createError('联网搜索需要配置 GEMINI_API_KEY');
      return;
    }

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${geminiApiKey}`;

    const systemPrompt = `你是一个实时信息搜索助手。请基于联网搜索获取的实时信息，整理并输出准确、时效性强的内容。

输出要求：
1. 严禁使用 Markdown 格式标记
2. 每个要点独立成段
3. 注明信息来源和时间
4. 区分事实和推测`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n搜索查询：${input.query}` }],
        },
      ],
      tools: [
        {
          googleSearch: {},
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    };

    try {
      yield this.createMetadata({
        model,
        searchQuery: input.query,
        startTime: Date.now(),
      });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API 调用失败: ${response.status} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let groundingMetadata: unknown = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // 尝试解析 JSON 片段
        const jsonMatches = buffer.match(/\{[^{}]*\}|\[[\s\S]*?\]/g);
        
        if (jsonMatches) {
          for (const jsonStr of jsonMatches) {
            try {
              const parsed = JSON.parse(jsonStr);
              
              if (parsed.candidates?.[0]?.content?.parts) {
                for (const part of parsed.candidates[0].content.parts) {
                  if (part.text) {
                    fullContent += part.text;
                    yield this.createChunk(part.text);
                  }
                }
              }
              
              if (parsed.candidates?.[0]?.groundingMetadata) {
                groundingMetadata = parsed.candidates[0].groundingMetadata;
              }
              
              buffer = buffer.replace(jsonStr, '');
            } catch {
              // JSON 解析失败，继续累积
            }
          }
        }
      }

      // 添加搜索来源
      const sources = this.formatGroundingMetadata(groundingMetadata);
      if (sources) {
        const sourceText = `\n\n---\n信息来源：\n${sources}`;
        fullContent += sourceText;
        yield this.createChunk(sourceText);
      }

      yield this.createComplete(fullContent, {
        model,
        groundingMetadata,
      });
    } catch (error) {
      yield this.createError(
        error instanceof Error ? error.message : '联网搜索失败'
      );
    }
  }

  /**
   * 格式化 Grounding Metadata
   */
  private formatGroundingMetadata(metadata: unknown): string | null {
    try {
      const meta = metadata as {
        groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
      };
      
      const sources: string[] = [];
      
      if (meta?.groundingChunks) {
        for (const chunk of meta.groundingChunks) {
          if (chunk.web?.uri && chunk.web?.title) {
            sources.push(`${chunk.web.title} ${chunk.web.uri}`);
          } else if (chunk.web?.uri) {
            sources.push(chunk.web.uri);
          }
        }
      }
      
      return sources.length > 0 ? sources.slice(0, 5).join('\n') : null;
    } catch {
      return null;
    }
  }
}

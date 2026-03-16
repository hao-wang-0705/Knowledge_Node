/**
 * 自然语言搜索解析工具
 * 将自然语言查询转换为结构化 SearchConfig
 */

import { BaseTool } from './base.tool';
import { ToolInput, ToolOutput, ToolCategory, ExecutionContext } from '../interfaces';

export interface SearchNLTagSchema {
  id: string;
  name: string;
  icon?: string;
  fields: Array<{
    key: string;
    name: string;
    type: 'text' | 'number' | 'date' | 'select';
    options?: string[];
  }>;
}

export interface SearchNLParseInput extends ToolInput {
  /** 用户输入的自然语言查询 */
  query: string;
  /** 可用的 Supertag Schema 列表 */
  supertags: SearchNLTagSchema[];
}

export interface SearchNLParseResponse {
  success: boolean;
  config?: {
    logicalOperator: 'AND' | 'OR';
    conditions: Array<{
      type: 'keyword' | 'tag' | 'field' | 'date' | 'ancestor';
      field?: string;
      operator: string;
      value: string | number | boolean | string[];
      negate?: boolean;
    }>;
  };
  explanation?: string;
  warnings?: string[];
  confidence?: number;
  error?: string;
  suggestions?: string[];
}

const SEARCH_NL_PARSE_SYSTEM_PROMPT = `你是一个智能查询助手，负责将用户的自然语言描述转换为结构化的搜索条件。

## 核心任务
将用户的自然语言查询解析为 JSON 格式的搜索配置，确保输出与系统现有的 SearchConfig 结构完全兼容。

## 支持的条件类型
1. **keyword**: 节点文本关键词匹配
   - operator: contains（包含）, equals（精确匹配）
   - value: 字符串

2. **tag**: 标签筛选（supertagId）
   - operator: equals（等于）, isNot（不等于）
   - value: 标签ID（从提供的标签列表中匹配）

3. **field**: 字段条件（匹配 fieldValues 中的字段）
   - operator: equals, contains, gt, lt, gte, lte, is, isNot, hasAny, hasAll
   - field: 字段 key（从提供的标签字段定义中匹配）
   - value: 根据字段类型确定格式

4. **date**: 时间条件（createdAt/updatedAt）
   - operator: today（今天）, withinDays（N天内）, gt, lt, gte, lte
   - field: createdAt 或 updatedAt
   - value: 日期字符串（YYYY-MM-DD）或天数

## 解析规则
1. **标签名称转ID**: 用户说"任务"时，匹配到对应标签的 ID
2. **相对日期转换**: "明天"→当前日期+1天，"下周五"→计算具体日期，"3天内"→使用 withinDays
3. **字段名匹配**: 用户说"截止日期"时，匹配到对应字段的 key（如 due_date）
4. **选项值匹配**: 用户说"未完成"时，匹配到字段选项中最接近的值
5. **逻辑组合**: 默认使用 AND，用户明确说"或者"时使用 OR

## 置信度评估
- 0.9+: 完全明确的查询，所有条件都能精确匹配
- 0.7-0.9: 大部分明确，少量需要推断
- 0.5-0.7: 存在歧义，可能需要确认
- <0.5: 无法理解意图，建议返回错误

## 输出规则
- 必须输出合法的 JSON
- success 为 true 时必须包含 config 和 explanation
- success 为 false 时必须包含 error 和 suggestions
- 不要猜测用户意图，宁可报错也不胡乱匹配
- 不要添加 markdown 代码块标记，直接返回 JSON`;

export class SearchNLParseTool extends BaseTool<SearchNLParseInput, ToolOutput> {
  readonly name = 'search_nl_parse';
  readonly description = '自然语言搜索解析工具，将用户的自然语言查询转换为结构化的搜索条件';
  readonly category: ToolCategory = 'search';
  readonly requiresContext = false;

  readonly inputSchema = {
    type: 'object',
    properties: {
      query: { type: 'string', description: '用户输入的自然语言查询' },
      supertags: {
        type: 'array',
        description: '可用的 Supertag Schema 列表',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            icon: { type: 'string' },
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
    required: ['query', 'supertags'],
  };

  async *execute(input: SearchNLParseInput, context: ExecutionContext): AsyncGenerator<ToolOutput> {
    const client = this.getClient();
    const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

    try {
      yield this.createMetadata({ model, startTime: Date.now() });

      const userPrompt = this.buildUserPrompt(input);

      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: SEARCH_NL_PARSE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1024,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '';

      // 解析响应
      const parsed = this.parseResponse(content);

      yield this.createComplete(JSON.stringify(parsed), {
        tokensUsed: response.usage?.total_tokens,
        model,
      });
    } catch (error) {
      yield this.createError(
        error instanceof Error ? error.message : '搜索条件解析失败'
      );
    }
  }

  private buildUserPrompt(input: SearchNLParseInput): string {
    const { query, supertags } = input;

    const today = new Date();
    const currentDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][today.getDay()];
    const dateContext = `今天是 ${currentDate}（星期${weekday}）`;

    const tagListDesc = supertags.map((tag) => {
      const fieldsDesc = tag.fields
        .map((f) => {
          let desc = `${f.name}(key: ${f.key}, type: ${f.type})`;
          if (f.type === 'select' && f.options && f.options.length > 0) {
            desc += ` [选项: ${f.options.join(', ')}]`;
          }
          return desc;
        })
        .join('\n    - ');

      return `- ${tag.icon || '📌'} **${tag.name}** (ID: \`${tag.id}\`)
    ${fieldsDesc ? `字段:\n    - ${fieldsDesc}` : '无自定义字段'}`;
    }).join('\n\n');

    return `## 日期上下文
${dateContext}

## 用户查询
"${query}"

## 可用标签及字段定义
${tagListDesc || '暂无标签定义'}

## 输出格式
请直接返回 JSON，不要包含 markdown 代码块标记。

成功时：
{
  "success": true,
  "config": {
    "logicalOperator": "AND",
    "conditions": [
      { "type": "keyword", "operator": "contains", "value": "关键词" },
      { "type": "tag", "operator": "equals", "value": "标签ID" },
      { "type": "field", "field": "字段key", "operator": "操作符", "value": "值" },
      { "type": "date", "field": "createdAt", "operator": "withinDays", "value": 7 }
    ]
  },
  "explanation": "人类可读的条件描述",
  "confidence": 0.92
}

失败时：
{
  "success": false,
  "error": "无法理解您的查询意图",
  "suggestions": ["请尝试更具体的描述，例如..."]
}`;
  }

  private parseResponse(content: string): SearchNLParseResponse {
    let cleaned = content.trim();

    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    try {
      const parsed = JSON.parse(cleaned);

      if (typeof parsed.success !== 'boolean') {
        return {
          success: false,
          error: 'AI 响应格式错误：缺少 success 字段',
          suggestions: ['请重试或使用手动配置模式'],
        };
      }

      if (parsed.success) {
        if (!parsed.config || !Array.isArray(parsed.config.conditions)) {
          return {
            success: false,
            error: 'AI 响应格式错误：缺少有效的 config',
            suggestions: ['请重试或使用手动配置模式'],
          };
        }

        return {
          success: true,
          config: {
            logicalOperator: parsed.config.logicalOperator || 'AND',
            conditions: parsed.config.conditions,
          },
          explanation: parsed.explanation || '',
          warnings: Array.isArray(parsed.warnings) ? parsed.warnings : undefined,
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
        };
      } else {
        return {
          success: false,
          error: parsed.error || '无法理解查询意图',
          suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : ['请尝试更具体的描述'],
        };
      }
    } catch (e) {
      return {
        success: false,
        error: 'AI 响应解析失败',
        suggestions: ['请重试或使用手动配置模式'],
      };
    }
  }
}

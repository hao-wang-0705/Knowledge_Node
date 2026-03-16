/**
 * 意图分析器
 * 分析用户自然语言指令，识别意图并推荐工具
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  IntentAnalysisResult,
  ContextQueryDSL,
  ActionStrategy,
} from '../interfaces';
import { ToolRegistry } from '../tools';

@Injectable()
export class IntentAnalyzer {
  private readonly logger = new Logger(IntentAnalyzer.name);
  private openai: OpenAI | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly toolRegistry: ToolRegistry,
  ) {
    this.initializeClient();
  }

  private initializeClient(): void {
    const geminiApiKey = this.configService.get<string>('GEMINI_API_KEY');
    const venusApiKey = this.configService.get<string>('VENUS_API_KEY');
    const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (geminiApiKey) {
      this.openai = new OpenAI({
        apiKey: geminiApiKey,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      });
    } else if (venusApiKey) {
      this.openai = new OpenAI({
        apiKey: venusApiKey,
        baseURL: this.configService.get<string>('VENUS_API_URL') || 'http://v2.open.venus.oa.com/llmproxy',
      });
    } else if (openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: openaiApiKey,
        baseURL: this.configService.get<string>('OPENAI_BASE_URL'),
      });
    }
  }

  private getModel(): string {
    if (this.configService.get<string>('GEMINI_API_KEY')) {
      return this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
    }
    if (this.configService.get<string>('VENUS_API_KEY')) {
      return this.configService.get<string>('VENUS_MODEL') || 'gemini-2.5-flash';
    }
    return this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
  }

  /**
   * 分析用户意图
   */
  async analyze(userPrompt: string): Promise<IntentAnalysisResult> {
    if (!this.openai) {
      this.logger.warn('AI client not configured, using rule-based analysis');
      return this.ruleBasedAnalysis(userPrompt);
    }

    try {
      const systemPrompt = this.buildIntentAnalysisPrompt();
      
      const response = await this.openai.chat.completions.create({
        model: this.getModel(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请分析以下用户指令：\n\n${userPrompt}` },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      return this.normalizeResult(parsed, userPrompt);
    } catch (error) {
      this.logger.error('Intent analysis failed:', error);
      return this.ruleBasedAnalysis(userPrompt);
    }
  }

  /**
   * 构建意图分析系统提示词
   */
  private buildIntentAnalysisPrompt(): string {
    // 获取所有可用工具的描述
    const toolDescriptions = this.toolRegistry.getToolDescriptions();
    const toolList = toolDescriptions
      .map(t => `- ${t.name}: ${t.description} (分类: ${t.category})`)
      .join('\n');

    return `你是一个智能意图分析系统，负责分析用户的自然语言指令并选择合适的工具。

## 可用工具列表
${toolList}

## 输出格式
请输出 JSON 格式的分析结果：
{
  "primaryIntent": "主要意图描述",
  "subIntents": ["子意图1", "子意图2"],  // 如果是多步任务
  "recommendedTools": ["tool_name_1", "tool_name_2"],  // 推荐的工具名称
  "confidence": 0.95,  // 置信度 0-1
  "requiresContext": true,  // 是否需要上下文
  "contextQueryDSL": {
    "tags": ["标签"],
    "dateRange": "today|yesterday|this_week|last_week|this_month|last_month|null",
    "scope": "relative|global",
    "keywords": ["关键词"]
  },
  "actionStrategy": "append_children|replace_content|create_sibling|return_only"
}

## 工具选择规则
1. 联网搜索需求（新闻、实时信息、股价、天气）→ web_search
2. 总结归纳需求 → summarize
3. 内容扩写需求 → expand
4. 通用文本生成 → text_generate
5. 语音转写需求 → transcribe

## 多步任务识别
如果用户需求需要多个步骤完成（如"搜索最新新闻并总结"），请在 recommendedTools 中按顺序列出所有需要的工具。

## actionStrategy 判断
- 总结、分析类 → append_children（追加子节点）
- 扩写、改写类 → replace_content（替换内容）
- 对比、参照类 → create_sibling（创建兄弟节点）
- 独立查询类 → return_only（仅返回结果）

只输出 JSON，不要有其他内容。`;
  }

  /**
   * 基于规则的意图分析（备选方案）
   */
  private ruleBasedAnalysis(prompt: string): IntentAnalysisResult {
    const lowerPrompt = prompt.toLowerCase();

    // 联网搜索关键词
    const webSearchKeywords = ['联网', '搜索', '新闻', '天气', '股价', '实时', '最新动态', '在线查找'];
    if (webSearchKeywords.some(kw => prompt.includes(kw))) {
      return {
        primaryIntent: '联网搜索',
        recommendedTools: ['web_search'],
        confidence: 0.8,
        requiresContext: false,
        actionStrategy: 'append_children',
      };
    }

    // 总结关键词
    const summarizeKeywords = ['总结', '归纳', '提炼', '概括', '摘要', '要点'];
    if (summarizeKeywords.some(kw => prompt.includes(kw))) {
      return {
        primaryIntent: '内容总结',
        recommendedTools: ['summarize'],
        confidence: 0.8,
        requiresContext: true,
        contextQueryDSL: this.extractContextDSL(prompt),
        actionStrategy: 'append_children',
      };
    }

    // 扩写关键词
    const expandKeywords = ['扩写', '展开', '详细', '补充', '丰富'];
    if (expandKeywords.some(kw => prompt.includes(kw))) {
      return {
        primaryIntent: '内容扩展',
        recommendedTools: ['expand'],
        confidence: 0.8,
        requiresContext: true,
        actionStrategy: 'replace_content',
      };
    }

    // 默认使用文本生成
    return {
      primaryIntent: '通用文本生成',
      recommendedTools: ['text_generate'],
      confidence: 0.6,
      requiresContext: this.inferRequiresContext(prompt),
      contextQueryDSL: this.extractContextDSL(prompt),
      actionStrategy: 'append_children',
    };
  }

  /**
   * 从 Prompt 中提取上下文 DSL
   */
  private extractContextDSL(prompt: string): ContextQueryDSL {
    const dsl: ContextQueryDSL = {};
    
    // 提取 # 标签
    const tagMatches = prompt.match(/#(\S+)/g);
    if (tagMatches) {
      dsl.tags = tagMatches.map(t => t.slice(1));
    }
    
    // 提取时间范围
    if (prompt.includes('今天')) dsl.dateRange = 'today';
    else if (prompt.includes('昨天')) dsl.dateRange = 'yesterday';
    else if (prompt.includes('本周') || prompt.includes('这周')) dsl.dateRange = 'this_week';
    else if (prompt.includes('上周')) dsl.dateRange = 'last_week';
    else if (prompt.includes('本月') || prompt.includes('这个月')) dsl.dateRange = 'this_month';
    else if (prompt.includes('上个月')) dsl.dateRange = 'last_month';
    
    // 判断范围
    dsl.scope = (prompt.includes('全局') || prompt.includes('所有') || prompt.includes('整个')) ? 'global' : 'relative';
    
    return dsl;
  }

  /**
   * 推断是否需要上下文
   */
  private inferRequiresContext(prompt: string): boolean {
    const noContextKeywords = ['联网搜索', '在线查找', '搜索网络', '新闻', '天气', '股价', '实时'];
    if (noContextKeywords.some(kw => prompt.includes(kw))) {
      return false;
    }
    
    const contextKeywords = [
      '总结', '分析', '基于', '根据', '所有', '这些', '上周', '本月', '相关',
      '子节点', '笔记', '内容', '任务', '项目', '归纳', '整理', '当前', '这个'
    ];
    
    return contextKeywords.some(kw => prompt.includes(kw));
  }

  /**
   * 规范化分析结果
   */
  private normalizeResult(parsed: Partial<IntentAnalysisResult>, userPrompt: string): IntentAnalysisResult {
    return {
      primaryIntent: parsed.primaryIntent || '通用处理',
      subIntents: parsed.subIntents,
      recommendedTools: parsed.recommendedTools || ['text_generate'],
      confidence: parsed.confidence || 0.5,
      requiresContext: parsed.requiresContext ?? this.inferRequiresContext(userPrompt),
      contextQueryDSL: parsed.contextQueryDSL || this.extractContextDSL(userPrompt),
      actionStrategy: parsed.actionStrategy || 'append_children',
      rawAnalysis: parsed as Record<string, unknown>,
    };
  }
}

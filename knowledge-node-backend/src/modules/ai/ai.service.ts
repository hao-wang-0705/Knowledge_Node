import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  ExecuteCommandDto,
  IntentAnalysisResult,
  CommandCategory,
  ContextQueryDSL,
} from './dto/command.dto';
import {
  QuickActionDto,
  QuickActionType,
  QuickActionNodeEvent,
  QuickActionReplaceEvent,
  QuickActionDoneEvent,
} from './dto/quick-action.dto';

/**
 * 聚合请求 DTO
 */
export interface AggregateRequestDto {
  tagId: string;
  prompt: string;
  nodes: Array<{
    id: string;
    content: string;
    fields?: Record<string, unknown>;
  }>;
  forceRefresh?: boolean;
}

/**
 * 缓存记录
 */
export interface AggregateCache {
  id: string;
  tagId: string;
  queryHash: string;
  content: string;
  nodeRefs: string[];
  standup?: StandupSummaryPayload;
  createdAt: Date;
  expiresAt: Date;
}

interface StandupSummaryItem {
  nodeId: string;
  title: string;
  summary: string;
  status?: string;
  priority?: string;
  dueDate?: string;
}

interface StandupSummaryPayload {
  highRisk: StandupSummaryItem[];
  progress: StandupSummaryItem[];
  risks: StandupSummaryItem[];
  stats: {
    totalCandidates: number;
    highRiskCount: number;
    inProgressCount: number;
    riskCount: number;
  };
}

interface AggregateNodeInput {
  id: string;
  content: string;
  fields?: Record<string, unknown>;
}

interface EnrichedTask extends StandupSummaryItem {
  isOverdue: boolean;
  isDueToday: boolean;
  isHighPriority: boolean;
}

/**
 * 内存缓存
 */
const memoryCache = new Map<string, AggregateCache>();

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private openai: OpenAI | null = null;
  private readonly DEFAULT_CACHE_TTL = 900; // 15 分钟

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // 初始化 AI 客户端 - 支持多种配置方式
    // 优先级：GEMINI > VENUS > OPENAI
    const geminiApiKey = this.configService.get<string>('GEMINI_API_KEY');
    const venusApiKey = this.configService.get<string>('VENUS_API_KEY');
    const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
    
    // Gemini 配置（通过 OpenAI 兼容层）
    if (geminiApiKey) {
      this.openai = new OpenAI({
        apiKey: geminiApiKey,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      });
      this.logger.log('AI 服务已初始化 (Gemini API)');
    }
    // Venus 配置（腾讯内部）
    else if (venusApiKey) {
      const venusBaseUrl = this.configService.get<string>('VENUS_API_URL') 
        || this.configService.get<string>('NEXT_PUBLIC_VENUS_API_URL')
        || 'http://v2.open.venus.oa.com/llmproxy';
      this.openai = new OpenAI({
        apiKey: venusApiKey,
        baseURL: venusBaseUrl,
      });
      this.logger.log('AI 服务已初始化 (Venus API)');
    }
    // OpenAI 配置
    else if (openaiApiKey) {
      const baseURL = this.configService.get<string>('OPENAI_BASE_URL');
      this.openai = new OpenAI({
        apiKey: openaiApiKey,
        baseURL: baseURL || undefined,
      });
      this.logger.log('AI 服务已初始化 (OpenAI API)');
    } else {
      this.logger.warn('未配置任何 AI 服务。请设置 GEMINI_API_KEY、VENUS_API_KEY 或 OPENAI_API_KEY');
    }
  }

  /**
   * 获取当前使用的 AI 模型名称
   * 优先级：GEMINI > VENUS > OPENAI 配置
   */
  private getAIModel(): string {
    if (this.configService.get<string>('GEMINI_API_KEY')) {
      return this.configService.get<string>('GEMINI_MODEL') 
        || this.configService.get<string>('NEXT_PUBLIC_GEMINI_MODEL') 
        || 'gemini-2.5-flash';
    }
    if (this.configService.get<string>('VENUS_API_KEY')) {
      return this.configService.get<string>('VENUS_MODEL')
        || this.configService.get<string>('NEXT_PUBLIC_VENUS_MODEL')
        || 'gemini-2.5-flash';
    }
    return this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
  }

  /**
   * 计算查询 hash
   */
  private hashQuery(prompt: string, nodeIds: string[]): string {
    const str = JSON.stringify({ prompt, nodeIds: nodeIds.sort() });
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private toDateOnly(value: unknown): Date | null {
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private toToday(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private normalizeTitle(content: string): string {
    const raw = (content || '').trim();
    if (!raw) {
      return '未命名任务';
    }
    return raw.length > 50 ? `${raw.slice(0, 50)}...` : raw;
  }

  private buildSummaryPayload(nodes: AggregateNodeInput[]): StandupSummaryPayload {
    const today = this.toToday();

    const enriched: EnrichedTask[] = nodes.map((node) => {
      const status = String(node.fields?.task_status || '').trim();
      const priority = String(node.fields?.task_priority || '').trim();
      const dueDateRaw = node.fields?.due_date;
      const dueDateObj = this.toDateOnly(dueDateRaw);

      const isClosed = status === '已完成' || status === '已取消';
      const isDueToday = !!dueDateObj && !isClosed && dueDateObj.getTime() === today.getTime();
      const isOverdue = !!dueDateObj && !isClosed && dueDateObj.getTime() < today.getTime();
      const isHighPriority = priority === 'P0' || priority === 'P1';

      const summaryPrefix = isOverdue
        ? '已逾期'
        : isDueToday
          ? '今日到期'
          : isHighPriority
            ? '高优先级'
            : status === '进行中'
              ? '进行中'
              : status || '待处理';

      return {
        nodeId: node.id,
        title: this.normalizeTitle(node.content),
        summary: summaryPrefix,
        status: status || undefined,
        priority: priority || undefined,
        dueDate: typeof dueDateRaw === 'string' ? dueDateRaw : undefined,
        isOverdue,
        isDueToday,
        isHighPriority,
      };
    });

    const highRisk = enriched.filter((t) => t.isOverdue || t.isDueToday || t.isHighPriority);
    const highRiskIds = new Set(highRisk.map((t) => t.nodeId));
    const progress = enriched.filter((t) => t.status === '进行中' && !highRiskIds.has(t.nodeId));
    const risks = enriched.filter((t) => t.status === '已阻塞');

    const pickTop = (items: EnrichedTask[]) =>
      items
        .slice(0, 3)
        .map(({ isOverdue: _a, isDueToday: _b, isHighPriority: _c, ...rest }) => rest);

    return {
      highRisk: pickTop(highRisk),
      progress: pickTop(progress),
      risks: pickTop(risks),
      stats: {
        totalCandidates: nodes.length,
        highRiskCount: highRisk.length,
        inProgressCount: progress.length,
        riskCount: risks.length,
      },
    };
  }

  private buildSystemPrompt(nodes: AggregateNodeInput[], standup: StandupSummaryPayload): string {
    const context = nodes
      .map((n, i) => {
        const fieldsStr = n.fields
          ? Object.entries(n.fields)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ')
          : '';
        return `[${i + 1}] ${this.normalizeTitle(n.content)}${fieldsStr ? ` (${fieldsStr})` : ''} [[${n.id}]]`;
      })
      .join('\n');

    const groupedJson = JSON.stringify(standup, null, 2);

    return `你是任务站会纪要助手。请严格遵循以下规则：
1) 输出仅包含三个小节：高优预警、进展摘要、阻塞风险。
2) 每个小节最多 3 条。没有内容时可以省略该小节。
3) 引用任务时必须使用 [[nodeId]] 或 [[nodeId|任务标题]]。
4) nodeId 仅用于系统锚点，禁止在可见文本中裸露 nodeId。
5) 不得编造不存在的 nodeId，只能使用下方任务列表中的 id。
6) 语言简洁、适合晨会口播，不要输出额外总结段落。

Few-shot 示例：
输入任务：
[1] 修复登录页 404 (task_status: 进行中, task_priority: P0, due_date: 2026-03-09) [[node-a]]
[2] 完成接口文档 (task_status: 待启动, task_priority: P2, due_date: 2026-03-12) [[node-b]]
输出示例：
### 高优预警
- 登录页故障需优先修复 [[node-a]]
### 进展摘要
- 接口文档尚未启动，建议尽快排期 [[node-b]]

任务原始上下文：
${context}

预计算分组（你应优先依据本分组生成）：
${groupedJson}`;
  }

  private transformNodeLinksWithTitle(
    rawText: string,
    nodeTitleMap: Map<string, string>,
  ): string {
    return rawText.replace(/\[\[([a-zA-Z0-9_-]+)\]\]/g, (_full, nodeId: string) => {
      const title = nodeTitleMap.get(nodeId);
      if (!title) {
        return '[[未命名任务]]';
      }
      return `[[${nodeId}|${title}]]`;
    });
  }

  /**
   * 流式聚合处理
   */
  async streamAggregate(dto: AggregateRequestDto, res: Response): Promise<void> {
    const { tagId, prompt, nodes, forceRefresh } = dto;
    const nodeIds = nodes.map((n) => n.id);
    const queryHash = this.hashQuery(prompt, nodeIds);
    const standupPayload = this.buildSummaryPayload(nodes);
    const nodeTitleMap = new Map(nodes.map((n) => [n.id, this.normalizeTitle(n.content)]));

    // 检查缓存（如果不是强制刷新）
    if (!forceRefresh) {
      const cached = await this.getCache(tagId, queryHash);
      if (cached) {
        // 返回缓存内容
        res.write(`data: ${JSON.stringify({ event: 'chunk', data: { text: cached.content } })}\n\n`);
        
        // 返回节点引用
        for (const nodeId of cached.nodeRefs) {
          const node = nodes.find((n) => n.id === nodeId);
          if (node) {
            res.write(`data: ${JSON.stringify({
              event: 'nodeRef',
              data: { nodeId, title: node.content?.slice(0, 50) || '' },
            })}\n\n`);
          }
        }
        
        // 完成
        res.write(`data: ${JSON.stringify({
          event: 'done',
          data: { content: cached.content, nodeRefs: cached.nodeRefs, standup: cached.standup || standupPayload },
        })}\n\n`);
        res.end();
        return;
      }
    }

    // 如果没有 OpenAI 客户端，返回模拟数据
    if (!this.openai) {
      const mockContent = this.generateMockContent(nodes, standupPayload);
      await this.streamMockContent(mockContent, nodes, standupPayload, res);
      
      // 保存到缓存
      await this.setCache(tagId, queryHash, mockContent, nodeIds, standupPayload);
      return;
    }
    const systemPrompt = this.buildSystemPrompt(nodes, standupPayload);

    try {
      // 调用 AI 流式接口
      const stream = await this.openai.chat.completions.create({
        model: this.getAIModel(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        stream: true,
      });

      let fullContent = '';
      const referencedNodeIds = new Set<string>();

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          const transformedChunk = this.transformNodeLinksWithTitle(content, nodeTitleMap);
          fullContent += transformedChunk;
          
          // 发送文本片段
          res.write(`data: ${JSON.stringify({ event: 'chunk', data: { text: transformedChunk } })}\n\n`);
          
          // 解析节点引用
          const nodeRefMatches = transformedChunk.match(/\[\[([a-zA-Z0-9_-]+)(?:\|[^\]]+)?\]\]/g);
          if (nodeRefMatches) {
            for (const match of nodeRefMatches) {
              const nodeIdMatch = match.match(/\[\[([a-zA-Z0-9_-]+)/);
              if (!nodeIdMatch) continue;
              const nodeId = nodeIdMatch[1];
              if (!referencedNodeIds.has(nodeId)) {
                referencedNodeIds.add(nodeId);
                const node = nodes.find((n) => n.id === nodeId);
                if (node) {
                  res.write(`data: ${JSON.stringify({
                    event: 'nodeRef',
                    data: { nodeId, title: node.content?.slice(0, 50) || '' },
                  })}\n\n`);
                }
              }
            }
          }
        }
      }

      // 保存到缓存
      await this.setCache(tagId, queryHash, fullContent, Array.from(referencedNodeIds), standupPayload);

      // 发送完成事件
      res.write(`data: ${JSON.stringify({
        event: 'done',
        data: { content: fullContent, nodeRefs: Array.from(referencedNodeIds), standup: standupPayload },
      })}\n\n`);
      res.end();
    } catch (error) {
      this.logger.error('AI streaming error:', error);
      res.write(`data: ${JSON.stringify({
        event: 'error',
        data: { code: 'AI_ERROR', message: error instanceof Error ? error.message : 'AI 调用失败' },
      })}\n\n`);
      res.end();
    }
  }

  /**
   * 生成模拟内容
   */
  private generateMockContent(
    nodes: Array<{ id: string; content: string }>,
    standup: StandupSummaryPayload,
  ): string {
    const nodeCount = nodes.length;
    const highRiskLines = standup.highRisk
      .slice(0, 3)
      .map((item) => `- ${item.summary} [[${item.nodeId}|${item.title}]]`)
      .join('\n');
    const progressLines = standup.progress
      .slice(0, 3)
      .map((item) => `- ${item.summary} [[${item.nodeId}|${item.title}]]`)
      .join('\n');
    const riskLines = standup.risks
      .slice(0, 3)
      .map((item) => `- ${item.summary} [[${item.nodeId}|${item.title}]]`)
      .join('\n');

    const sections: string[] = [];
    if (highRiskLines) {
      sections.push(`### 高优预警\n${highRiskLines}`);
    }
    if (progressLines) {
      sections.push(`### 进展摘要\n${progressLines}`);
    }
    if (riskLines) {
      sections.push(`### 阻塞风险\n${riskLines}`);
    }
    if (sections.length === 0) {
      sections.push('### 进展摘要\n- 当前未发现需要重点播报的事项。');
    }

    return `基于 ${nodeCount} 个任务候选生成站会纪要：\n\n${sections.join('\n\n')}`;
  }

  /**
   * 流式输出模拟内容
   */
  private async streamMockContent(
    content: string,
    nodes: Array<{ id: string; content: string }>,
    standup: StandupSummaryPayload,
    res: Response,
  ): Promise<void> {
    // 模拟打字机效果
    const chunks = content.match(/.{1,10}/g) || [];
    const referencedNodeIds = new Set<string>();

    for (const chunk of chunks) {
      res.write(`data: ${JSON.stringify({ event: 'chunk', data: { text: chunk } })}\n\n`);
      
      // 解析节点引用
      const nodeRefMatches = chunk.match(/\[\[([a-zA-Z0-9_-]+)\]\]/g);
      if (nodeRefMatches) {
        for (const match of nodeRefMatches) {
          const nodeId = match.slice(2, -2);
          if (!referencedNodeIds.has(nodeId)) {
            referencedNodeIds.add(nodeId);
            const node = nodes.find((n) => n.id === nodeId);
            if (node) {
              res.write(`data: ${JSON.stringify({
                event: 'nodeRef',
                data: { nodeId, title: node.content?.slice(0, 50) || '' },
              })}\n\n`);
            }
          }
        }
      }
      
      // 模拟延迟
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // 发送完成事件
    res.write(`data: ${JSON.stringify({
      event: 'done',
      data: { content, nodeRefs: Array.from(referencedNodeIds), standup },
    })}\n\n`);
    res.end();
  }

  /**
   * 获取缓存
   */
  async getCache(tagId: string, queryHash: string): Promise<AggregateCache | null> {
    const cacheKey = `${tagId}-${queryHash}`;
    const cached = memoryCache.get(cacheKey);
    
    if (cached && cached.expiresAt > new Date()) {
      return cached;
    }
    
    // 缓存不存在或已过期
    if (cached) {
      memoryCache.delete(cacheKey);
    }
    
    return null;
  }

  /**
   * 设置缓存
   */
  async setCache(
    tagId: string,
    queryHash: string,
    content: string,
    nodeRefs: string[],
    standup?: StandupSummaryPayload,
    ttl: number = this.DEFAULT_CACHE_TTL,
  ): Promise<void> {
    const cacheKey = `${tagId}-${queryHash}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    const cache: AggregateCache = {
      id: cacheKey,
      tagId,
      queryHash,
      content,
      nodeRefs,
      standup,
      createdAt: now,
      expiresAt,
    };

    memoryCache.set(cacheKey, cache);
  }

  /**
   * 清除缓存
   */
  async invalidateCache(tagId: string, queryHash?: string): Promise<void> {
    if (queryHash) {
      // 清除特定缓存
      memoryCache.delete(`${tagId}-${queryHash}`);
    } else {
      // 清除该标签的所有缓存
      for (const key of memoryCache.keys()) {
        if (key.startsWith(`${tagId}-`)) {
          memoryCache.delete(key);
        }
      }
    }
  }

  // =========================================================================
  // v4.0: AI 指令节点 - 意图分析 + 执行
  // =========================================================================

  /**
   * v4.1.2: 增强版 Markdown 清洗函数
   * 5 轮清洗处理:嵌套标记、中文符号、冗余前缀、残留符号、空白规范化
   */
  private cleanMarkdownContent(content: string): string {
    try {
      return content
        // 第一轮:处理嵌套和连续的格式标记
        .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')       // 移除 * ** *** 所有变体
        .replace(/_+([^_]+)_+/g, '$1')                 // 移除下划线强调
        .replace(/#{1,6}\s*/g, '')                     // 移除标题符号
        
        // 第二轮:处理列表和结构化标记
        .replace(/^[-*+•➤▶︎→]\s+/gm, '')               // 移除列表符号(含中文)
        .replace(/^\d+[.)、]\s*/gm, '')                 // 移除编号(1. 1) 1、)
        .replace(/^[【\[]([^\]】]+)[\]】][:：]\s*/gm, '$1 ') // 【标签】: -> 标签
        
        // 第三轮:处理行内格式和链接
        .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')         // 移除代码标记
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')       // 移除链接,保留文本
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')        // 移除图片
        .replace(/^>\s*/gm, '')                        // 移除引用符号
        
        // 第四轮:清理冗余前缀和元信息
        .replace(/^(以下是|以下为|核心内容|关键信息|总结|背景说明)[:：]\s*/gm, '')
        .replace(/\s*[:：]\s*$/gm, '')                 // 移除行尾冒号
        
        // 第五轮:清理残留符号和规范化空白
        .replace(/[*_~`]+/g, '')                       // 移除残留格式符号
        .replace(/【】\(\)\[\]/g, '')                  // 移除空括号
        .replace(/\n{3,}/g, '\n\n')                    // 统一段落间距
        .replace(/^\s+/gm, '')                         // 移除行首空格
        .trim();
    } catch (error) {
      this.logger.warn('Content cleaning failed:', error);
      return content.trim();
    }
  }

  /**
   * v4.1.2: 智能分段算法
   * 逐行分析,识别列表项、结构化字段、段落边界,按逻辑拆分
   */
  private splitContentToParagraphs(content: string): string[] {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l);
    const paragraphs: string[] = [];
    let currentParagraph = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextLine = i < lines.length - 1 ? lines[i + 1] : null;
      
      // 检测列表项标记(包括中文符号)
      const isListItem = /^[-*+•➤▶︎→]/.test(line) || /^\d+[.)、]/.test(line);
      const nextIsListItem = nextLine && (/^[-*+•➤▶︎→]/.test(nextLine) || /^\d+[.)、]/.test(nextLine));
      
      // 检测结构化字段("负责人:"、"状态:"、"内容:")
      const isStructuredField = /^(负责人|状态|内容|时间|描述)[:：]/.test(line);
      
      // 检测段落结束标志
      const isParagraphEnd = /[。!?！？]$/.test(line) || line.length < 10;
      
      // 决策:是否独立成段
      if (isListItem || isStructuredField) {
        // 列表项和结构化字段独立成段
        if (currentParagraph) {
          paragraphs.push(this.cleanMarkdownContent(currentParagraph));
          currentParagraph = '';
        }
        paragraphs.push(this.cleanMarkdownContent(line));
      } else if (isParagraphEnd && (nextIsListItem || !nextLine)) {
        // 当前行是段落结尾,且下一行是列表或为空
        currentParagraph += (currentParagraph ? ' ' : '') + line;
        paragraphs.push(this.cleanMarkdownContent(currentParagraph));
        currentParagraph = '';
      } else {
        // 累积到当前段落
        currentParagraph += (currentParagraph ? ' ' : '') + line;
      }
    }
    
    // 处理最后一段
    if (currentParagraph) {
      paragraphs.push(this.cleanMarkdownContent(currentParagraph));
    }
    
    return paragraphs.filter(p => p.length > 0);
  }

  /**
   * 意图分析系统提示词
   */
  private readonly INTENT_ANALYSIS_SYSTEM_PROMPT = `你是一个智能助手，负责分析用户的自然语言指令并提取结构化配置。

请分析用户的指令，输出以下 JSON 格式：
{
  "commandCategory": "productivity|analysis|creative|summary|search|expansion|web_search",
  "requiresContext": true/false,
  "contextQueryDSL": {
    "tags": ["从用户 Prompt 中提取的 # 标签，不带 # 符号"],
    "dateRange": "today|yesterday|this_week|last_week|this_month|last_month|null",
    "scope": "relative|global",
    "keywords": ["关键词数组"]
  },
  "systemPrompt": "为主 LLM 生成的系统提示词，用于指导内容生成",
  "actionStrategy": "append_children|replace_content|create_sibling"
}

分类说明：
- productivity: 任务管理、待办事项、日程规划
- analysis: 数据分析、趋势洞察、对比研究
- creative: 创意发散、头脑风暴、内容创作
- summary: 总结归纳、周报月报、要点提炼
- search: 搜索查找、信息检索（本地知识库）
- expansion: 内容扩写、详细展开
- web_search: 联网搜索、实时信息查询、新闻资讯、最新动态、在线查找

⚠️ 重要：web_search 分类判断标准
当用户需求满足以下任一条件时，必须使用 web_search：
1. 明确要求联网/在线/实时搜索（如"联网搜索"、"在线查找"、"实时查询"）
2. 询问最新新闻、实时数据、当前价格、天气等时效性信息
3. 查询特定公司、产品、事件的最新动态
4. 用户知识库中不太可能存在的公开信息（如"特斯拉最新股价"、"今天的新闻"）
5. 包含"搜一下"、"查一下"、"帮我找找"等联网搜索意图的表述

范围判断：
- 如果 Prompt 提到"全局"、"所有"、"整个知识库"等，scope 设为 "global"
- 否则默认为 "relative"（当前节点子树）
- 注意：web_search 类型通常不需要本地上下文，requiresContext 通常为 false

时间范围关键词映射：
- "今天" -> "today"
- "昨天" -> "yesterday"  
- "这周"/"本周" -> "this_week"
- "上周" -> "last_week"
- "这个月"/"本月" -> "this_month"
- "上个月" -> "last_month"

actionStrategy 判断：
- 总结、分析类通常使用 "append_children" 在下方生成子节点
- 扩写、改写类通常使用 "replace_content" 替换当前内容
- 对比、参照类通常使用 "create_sibling" 创建兄弟节点
- web_search 联网搜索通常使用 "append_children" 将搜索结果作为子节点

【输出格式铁律】重要提示：
当你为主 LLM 生成 systemPrompt 时,必须在其中强制包含以下约束：

1. 严禁使用任何 Markdown 格式标记：** * _ # - + > [] () \` ~
2. 段落之间仅使用双换行符(\\n\\n)分隔,不使用其他分隔符
3. 列表项直接输出纯文本内容,每项独立成段,不加任何前缀符号
4. 人名、关键词、数字直接输出,不加强调标记
5. 数字编号使用纯文本形式,例如「1. 」而非「**1.**」或「1）」
6. 严禁输出元信息前缀(如"以下是..."、"总结："、"关键信息："等)
7. 每段只包含一个完整要点,段落长度控制在 50-150 字
8. 结构化内容(如任务列表)必须拆分：每个任务、子字段各占一段

正确示例：
"""
Dola与政企合作模式确认

内容 Dola与政企的合作模式需要确认合同方式

负责人 skyhwang(王昊)

状态 待启动
"""

错误示例：
"""
**总结：**

1. **Dola与政企合作模式确认：** * **内容：** Dola与政企的合作模式...
"""

只输出 JSON,不要有其他内容。`;

  /**
   * 分析用户意图
   */
  async analyzeIntent(userPrompt: string): Promise<IntentAnalysisResult> {
    // 如果没有配置 OpenAI，返回默认配置
    if (!this.openai) {
      this.logger.warn('OpenAI not configured, using default intent analysis');
      return this.getDefaultIntentAnalysis(userPrompt);
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: this.getAIModel(),
        messages: [
          { role: 'system', content: this.INTENT_ANALYSIS_SYSTEM_PROMPT },
          { role: 'user', content: `请分析以下用户指令：\n\n${userPrompt}` },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content) as IntentAnalysisResult;
      
      // 验证和补全必要字段
      return {
        commandCategory: this.validateCategory(parsed.commandCategory),
        requiresContext: parsed.requiresContext ?? this.inferRequiresContext(userPrompt),
        contextQueryDSL: parsed.contextQueryDSL || this.extractContextDSL(userPrompt),
        systemPrompt: parsed.systemPrompt || this.generateDefaultSystemPrompt(parsed.commandCategory, userPrompt),
        actionStrategy: parsed.actionStrategy || 'append_children',
      };
    } catch (error) {
      this.logger.error('Intent analysis failed, using default:', error);
      return this.getDefaultIntentAnalysis(userPrompt);
    }
  }

  /**
   * 验证并规范化分类
   */
  private validateCategory(category: string | undefined): CommandCategory {
    const validCategories: CommandCategory[] = ['productivity', 'analysis', 'creative', 'summary', 'search', 'expansion', 'web_search'];
    if (category && validCategories.includes(category as CommandCategory)) {
      return category as CommandCategory;
    }
    return 'summary';
  }

  /**
   * 推断是否需要上下文
   * 默认返回 true，除非明确判断不需要（如联网搜索等独立操作）
   */
  private inferRequiresContext(prompt: string): boolean {
    // 不需要上下文的关键词（如联网搜索、独立创作等）
    const noContextKeywords = ['联网搜索', '在线查找', '搜索网络', '新闻', '天气', '股价', '实时'];
    if (noContextKeywords.some(kw => prompt.includes(kw))) {
      return false;
    }
    
    // 需要上下文的关键词
    const contextKeywords = [
      '总结', '分析', '基于', '根据', '所有', '这些', '上周', '本月', '相关', '包含',
      '子节点', '笔记', '内容', '任务', '项目', '归纳', '整理', '提取', '列出', '统计',
      '当前', '这个', '下面', '以下', '已有', '现有'
    ];
    
    // 如果包含上下文关键词，返回 true
    if (contextKeywords.some(kw => prompt.includes(kw))) {
      return true;
    }
    
    // 默认需要上下文（大多数情况下用户需要基于现有内容操作）
    return true;
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
   * 生成默认系统提示词
   */
  private generateDefaultSystemPrompt(category: CommandCategory | undefined, userPrompt: string): string {
    const basePrompt = '你是一个专业的 AI 助手，请根据用户的需求和提供的上下文信息完成任务。';
    
    const categoryPrompts: Record<CommandCategory, string> = {
      productivity: '请专注于任务管理和效率提升，输出清晰的待办事项或行动计划。',
      analysis: '请进行深入分析，提供数据支持的洞察和结论。',
      creative: '请发挥创意，提供多样化的想法和建议。',
      summary: '请提炼核心要点，输出简洁有条理的总结。',
      search: '请根据条件搜索并列出相关内容。',
      expansion: '请详细展开内容，补充细节和说明。',
      web_search: '请基于联网搜索获取的实时信息，整理并输出准确、时效性强的内容。请注明信息来源。',
    };
    
    return `${basePrompt}\n${categoryPrompts[category || 'summary']}\n\n用户原始需求：${userPrompt}`;
  }

  /**
   * 默认意图分析结果
   */
  private getDefaultIntentAnalysis(userPrompt: string): IntentAnalysisResult {
    return {
      commandCategory: 'summary',
      requiresContext: this.inferRequiresContext(userPrompt),
      contextQueryDSL: this.extractContextDSL(userPrompt),
      systemPrompt: this.generateDefaultSystemPrompt('summary', userPrompt),
      actionStrategy: 'append_children',
    };
  }

  /**
   * 执行 AI 指令（SSE 流式输出）
   */
  async executeCommand(
    dto: ExecuteCommandDto,
    contextNodes: Array<{ id: string; content: string; fields?: Record<string, unknown> }>,
    res: Response,
  ): Promise<void> {
    const { surface, nodeId } = dto;
    
    // 1. 发送意图分析开始事件
    res.write(`data: ${JSON.stringify({ event: 'intent', data: { status: 'analyzing' } })}\n\n`);
    
    // 2. 执行意图分析
    const intentResult = await this.analyzeIntent(surface.userPrompt);
    
    res.write(`data: ${JSON.stringify({
      event: 'intent',
      data: {
        category: intentResult.commandCategory,
        requiresContext: intentResult.requiresContext,
        contextDescription: this.describeContext(intentResult.contextQueryDSL),
      },
    })}\n\n`);
    
    // 3. 发送上下文信息
    res.write(`data: ${JSON.stringify({
      event: 'context',
      data: {
        nodeCount: contextNodes.length,
        tokenEstimate: this.estimateTokens(contextNodes),
      },
    })}\n\n`);
    
    // 4. 如果没有 OpenAI，使用模拟输出
    if (!this.openai) {
      await this.streamMockCommandOutput(surface, intentResult, contextNodes, res);
      return;
    }
    
    // 5. 构建完整 Prompt
    const fullPrompt = this.buildCommandPrompt(surface.userPrompt, intentResult, contextNodes);
    
    try {
      // 6. 判断是否为联网搜索类型
      const isWebSearch = intentResult.commandCategory === 'web_search';
      
      if (isWebSearch) {
        // 6a. 联网搜索：使用 Gemini 原生 API with Google Search grounding
        await this.executeWebSearchCommand(surface.userPrompt, intentResult, res);
      } else {
        // 6b. 普通指令：使用 OpenAI 兼容接口
        await this.executeNormalCommand(fullPrompt, intentResult, res);
      }
    } catch (error) {
      this.logger.error('Command execution error:', error);
      res.write(`data: ${JSON.stringify({
        event: 'error',
        data: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'AI 执行失败',
        },
      })}\n\n`);
      res.end();
    }
  }

  /**
   * 执行普通指令（非联网搜索）
   * v4.1.1: 优化分段逻辑，清洗 Markdown 格式
   */
  private async executeNormalCommand(
    fullPrompt: string,
    intentResult: IntentAnalysisResult,
    res: Response,
  ): Promise<void> {
    const stream = await this.openai!.chat.completions.create({
      model: this.getAIModel(),
      messages: [
        { role: 'system', content: intentResult.systemPrompt },
        { role: 'user', content: fullPrompt },
      ],
      stream: true,
    });

    let fullContent = '';
    let nodeIndex = 0;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        
        // 发送文本片段
        res.write(`data: ${JSON.stringify({ event: 'chunk', data: { text: content } })}\n\n`);
        
        // 检测段落结束,发送节点事件(使用智能分段)
        const paragraphs = fullContent.split(/\n\n+/);
        while (paragraphs.length > 1) {
          const segment = paragraphs.shift()!;
          
          // 使用智能分段算法进一步拆分
          const subParagraphs = this.splitContentToParagraphs(segment);
          
          for (const paragraph of subParagraphs) {
            res.write(`data: ${JSON.stringify({
              event: 'node',
              data: {
                tempId: `temp-${nodeIndex++}`,
                parentTempId: null,
                content: paragraph,
              },
            })}\n\n`);
          }
          
          fullContent = paragraphs.join('\n\n');
        }
      }
    }

    // 处理最后一个段落(使用智能分段)
    const lastParagraphs = this.splitContentToParagraphs(fullContent);
    for (const paragraph of lastParagraphs) {
      res.write(`data: ${JSON.stringify({
        event: 'node',
        data: {
          tempId: `temp-${nodeIndex++}`,
          parentTempId: null,
          content: paragraph,
        },
      })}\n\n`);
    }

    // 发送完成事件
    res.write(`data: ${JSON.stringify({
      event: 'done',
      data: {
        success: true,
        nodeCount: nodeIndex,
        coreConfig: intentResult,
      },
    })}\n\n`);
    res.end();
  }

  /**
   * 执行联网搜索指令（使用 Google Search grounding）
   * 通过 Gemini 原生 REST API 启用 grounding 功能
   */
  private async executeWebSearchCommand(
    userPrompt: string,
    intentResult: IntentAnalysisResult,
    res: Response,
  ): Promise<void> {
    // 获取 Gemini API Key
    const geminiApiKey = this.configService.get<string>('GEMINI_API_KEY');
    
    if (!geminiApiKey) {
      // 没有 Gemini API Key，回退到普通搜索模式
      this.logger.warn('GEMINI_API_KEY not configured, falling back to normal search');
      res.write(`data: ${JSON.stringify({
        event: 'chunk',
        data: { text: '⚠️ 联网搜索功能需要配置 Gemini API Key。当前使用普通模式...\n\n' },
      })}\n\n`);
      
      // 使用普通模式执行
      const fullPrompt = `请回答以下问题（注意：当前未启用联网搜索，仅基于训练数据回答）：\n\n${userPrompt}`;
      await this.executeNormalCommand(fullPrompt, intentResult, res);
      return;
    }

    const model = this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${geminiApiKey}`;

    // 构建请求体，启用 Google Search grounding
    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${intentResult.systemPrompt}\n\n用户问题：${userPrompt}` }],
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
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error('Gemini API error:', errorText);
        throw new Error(`Gemini API 调用失败: ${response.status}`);
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let nodeIndex = 0;
      let groundingMetadata: unknown = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Gemini 流式响应是 JSON 数组的片段
        // 尝试解析完整的 JSON 对象
        const jsonMatches = buffer.match(/\{[^{}]*\}|\[[\s\S]*?\]/g);
        
        if (jsonMatches) {
          for (const jsonStr of jsonMatches) {
            try {
              const parsed = JSON.parse(jsonStr);
              
              // 提取文本内容
              if (parsed.candidates?.[0]?.content?.parts) {
                for (const part of parsed.candidates[0].content.parts) {
                  if (part.text) {
                    fullContent += part.text;
                    res.write(`data: ${JSON.stringify({ event: 'chunk', data: { text: part.text } })}\n\n`);
                  }
                }
              }
              
              // 提取 grounding metadata（搜索结果来源）
              if (parsed.candidates?.[0]?.groundingMetadata) {
                groundingMetadata = parsed.candidates[0].groundingMetadata;
              }
              
              // 从 buffer 中移除已处理的 JSON
              buffer = buffer.replace(jsonStr, '');
            } catch {
              // JSON 解析失败，可能是不完整的片段，继续累积
            }
          }
        }
      }

      // 添加搜索来源信息
      if (groundingMetadata) {
        const sources = this.formatGroundingMetadata(groundingMetadata);
        if (sources) {
          fullContent += `\n\n---\n信息来源：\n${sources}`;
          res.write(`data: ${JSON.stringify({ event: 'chunk', data: { text: `\n\n---\n信息来源：\n${sources}` } })}\n\n`);
        }
      }

      // 按段落生成节点（使用清洗函数）
      const paragraphs = this.splitContentToParagraphs(fullContent);
      for (const paragraph of paragraphs) {
        res.write(`data: ${JSON.stringify({
          event: 'node',
          data: {
            tempId: `temp-${nodeIndex++}`,
            parentTempId: null,
            content: paragraph,
          },
        })}\n\n`);
      }

      // 发送完成事件
      res.write(`data: ${JSON.stringify({
        event: 'done',
        data: {
          success: true,
          nodeCount: nodeIndex,
          coreConfig: intentResult,
          groundingMetadata,
        },
      })}\n\n`);
      res.end();
    } catch (error) {
      this.logger.error('Web search execution error:', error);
      throw error;
    }
  }

  /**
   * 格式化 Grounding Metadata 为可读的来源列表
   * v4.1.2: 移除 Markdown 标记,使用纯文本格式
   */
  private formatGroundingMetadata(metadata: unknown): string | null {
    try {
      const meta = metadata as {
        groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
        webSearchQueries?: string[];
        searchEntryPoint?: { renderedContent?: string };
      };
      
      const sources: string[] = [];
      
      // 提取网页来源(纯文本格式)
      if (meta.groundingChunks) {
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

  /**
   * 描述上下文条件
   */
  private describeContext(dsl: ContextQueryDSL | undefined): string {
    if (!dsl) return '当前节点';
    
    const parts: string[] = [];
    if (dsl.tags?.length) parts.push(`标签: ${dsl.tags.join(', ')}`);
    if (dsl.dateRange) {
      const dateLabels: Record<string, string> = {
        today: '今天',
        yesterday: '昨天',
        this_week: '本周',
        last_week: '上周',
        this_month: '本月',
        last_month: '上月',
      };
      parts.push(`时间: ${dateLabels[dsl.dateRange] || dsl.dateRange}`);
    }
    parts.push(`范围: ${dsl.scope === 'global' ? '全局' : '当前子树'}`);
    
    return parts.join(' | ') || '当前节点';
  }

  /**
   * 估算 Token 数量
   */
  private estimateTokens(nodes: Array<{ content: string }>): number {
    const totalChars = nodes.reduce((sum, n) => sum + (n.content?.length || 0), 0);
    return Math.ceil(totalChars / 2); // 简单估算：中文约 2 字符/token
  }

  /**
   * 构建完整的命令 Prompt
   */
  private buildCommandPrompt(
    userPrompt: string,
    intent: IntentAnalysisResult,
    contextNodes: Array<{ id: string; content: string; fields?: Record<string, unknown> }>,
  ): string {
    let prompt = `用户需求：${userPrompt}\n\n`;
    
    if (contextNodes.length > 0) {
      prompt += '相关上下文（共 ' + contextNodes.length + ' 个节点）：\n';
      prompt += '---\n';
      contextNodes.forEach((node, index) => {
        prompt += `[${index + 1}] ${node.content}`;
        if (node.fields && Object.keys(node.fields).length > 0) {
          const fieldsStr = Object.entries(node.fields)
            .filter(([, v]) => v != null)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
          if (fieldsStr) prompt += ` (${fieldsStr})`;
        }
        prompt += '\n';
      });
      prompt += '---\n\n';
    }
    
    prompt += '\n【输出格式铁律】\n';
    prompt += '1. 严禁使用任何 Markdown 格式标记(**、##、-、*、[]、> 等)\n';
    prompt += '2. 每个要点独立成段,段落间用双换行(\\n\\n)分隔\n';
    prompt += '3. 列表项直接输出内容,不加符号前缀(如 -、1.)\n';
    prompt += '4. 不要添加"以下是"、"总结:"等元信息前缀\n';
    prompt += '5. 结构化内容(任务、字段)分段输出,每段一个主题\n';
    prompt += '6. 直接输出核心内容,保持简洁\n';
    
    return prompt;
  }

  /**
   * 模拟指令输出（无 OpenAI 时使用）
   */
  private async streamMockCommandOutput(
    surface: { name: string; userPrompt: string },
    intent: IntentAnalysisResult,
    contextNodes: Array<{ id: string; content: string }>,
    res: Response,
  ): Promise<void> {
    const mockContent = this.generateMockCommandContent(surface, intent, contextNodes);
    const chunks = mockContent.match(/.{1,20}/g) || [];
    
    let fullContent = '';
    let nodeIndex = 0;
    
    for (const chunk of chunks) {
      fullContent += chunk;
      res.write(`data: ${JSON.stringify({ event: 'chunk', data: { text: chunk } })}\n\n`);
      await new Promise(resolve => setTimeout(resolve, 30));
      
      // 检测段落
      const paragraphs = fullContent.split(/\n\n+/);
      while (paragraphs.length > 1) {
        const paragraph = paragraphs.shift()!.trim();
        if (paragraph) {
          res.write(`data: ${JSON.stringify({
            event: 'node',
            data: {
              tempId: `temp-${nodeIndex++}`,
              parentTempId: null,
              content: paragraph,
            },
          })}\n\n`);
        }
        fullContent = paragraphs.join('\n\n');
      }
    }
    
    // 最后一个段落
    if (fullContent.trim()) {
      res.write(`data: ${JSON.stringify({
        event: 'node',
        data: {
          tempId: `temp-${nodeIndex++}`,
          parentTempId: null,
          content: fullContent.trim(),
        },
      })}\n\n`);
    }
    
    res.write(`data: ${JSON.stringify({
      event: 'done',
      data: {
        success: true,
        nodeCount: nodeIndex,
        coreConfig: intent,
      },
    })}\n\n`);
    res.end();
  }

  /**
   * 生成模拟指令内容
   */
  private generateMockCommandContent(
    surface: { name: string; userPrompt: string },
    intent: IntentAnalysisResult,
    contextNodes: Array<{ id: string; content: string }>,
  ): string {
    const categoryTitles: Record<CommandCategory, string> = {
      productivity: '📋 任务清单',
      analysis: '📊 分析报告',
      creative: '💡 创意想法',
      summary: '📝 内容总结',
      search: '🔍 搜索结果',
      expansion: '📖 详细内容',
      web_search: '🌐 联网搜索结果',
    };
    
    const title = categoryTitles[intent.commandCategory] || '📝 AI 生成内容';
    
    let content = `## ${title}\n\n`;
    content += `**指令：** ${surface.name}\n\n`;
    content += `基于您的需求「${surface.userPrompt}」，以下是 AI 生成的结果：\n\n`;
    
    if (contextNodes.length > 0) {
      content += `### 关键要点\n\n`;
      contextNodes.slice(0, 5).forEach((node, i) => {
        const summary = node.content.slice(0, 100).replace(/\n/g, ' ');
        content += `${i + 1}. ${summary}${node.content.length > 100 ? '...' : ''}\n\n`;
      });
    } else {
      content += `### 建议\n\n`;
      content += `1. 这是 AI 生成的第一个建议点\n\n`;
      content += `2. 这是 AI 生成的第二个建议点\n\n`;
      content += `3. 这是 AI 生成的第三个建议点\n\n`;
    }
    
    content += `---\n\n`;
    content += `*由 AI 指令「${surface.name}」自动生成*`;
    
    return content;
  }

  // =========================================================================
  // v4.1: 快捷动作 (Quick Actions)
  // =========================================================================

  /**
   * 快捷动作 System Prompt 配置
   */
  private readonly QUICK_ACTION_PROMPTS: Record<QuickActionType, string> = {
    extract_tasks: `你是一个任务提取专家。请从用户提供的文本中识别所有待办事项/任务。

输出要求：
1. 返回一个 JSON 数组，每个元素代表一个任务节点
2. 每个任务的格式为：
   {
     "tempId": "task-1",  // 临时 ID，从 task-1 开始递增
     "parentTempId": null,
     "content": "任务描述",
     "nodeType": "todo",
     "supertagId": "任务",  // 固定为 "任务"
     "fields": {
       "task_status": "待启动",
       "due_date": "2024-03-15"  // 如果文本中有时间信息则提取，否则为 null
     }
   }
3. 时间提取规则：
   - "今天" → 当天日期
   - "明天" → 明天日期
   - "后天" → 后天日期
   - "下周X" → 计算具体日期
   - "X月X日" → 转换为 ISO 日期格式
   - "周X前" / "X号前" → 提取为截止日期
4. 如果没有识别到任务，返回空数组 []
5. 只输出 JSON，不要有其他内容

今天是 {{today}}。`,

    structured_summary: `你是一个内容结构化专家。请从用户提供的文本中提取核心论点，生成层次清晰的大纲结构。

输出要求：
1. 返回一个 JSON 数组，表示层级结构的节点树
2. 核心观点使用 heading 类型，支撑论据使用 text 类型
3. 节点格式：
   {
     "tempId": "node-1",
     "parentTempId": null,  // 顶级节点为 null，子节点填入父节点 tempId
     "content": "核心观点或论据",
     "nodeType": "heading" | "text",
     "supertagId": null,
     "fields": {}
   }
4. 结构层级：
   - 第一层：核心论点（heading）
   - 第二层：支撑论据（text，parentTempId 指向对应 heading）
   - 可以有多层嵌套
5. 提炼规则：
   - 保留原文核心含义，但用更简洁的语言表达
   - 每个论点控制在 1-2 句话
   - 去除冗余信息和口语化表达
6. 只输出 JSON，不要有其他内容`,

    inline_rewrite: `你是一个专业文案优化专家。请将用户提供的简短文本扩写为更加专业、结构清晰的完整表述。

输出要求：
1. 直接输出扩写后的文本,不要 JSON 格式
2. 扩写规则：
   - 保持原意,但让表达更专业、更完整
   - 补充必要的背景和细节
   - 使用清晰的逻辑结构
   - 适当使用专业术语
3. 长度控制：
   - 简短输入（< 50 字）：扩写到 100-200 字
   - 中等输入（50-150 字）：扩写到 200-400 字
   - 较长输入（> 150 字）：润色优化,控制在原长度 1.5 倍以内
4. 格式约束：
   - 严禁使用 Markdown 标记(**、##、-、* 等)
   - 段落间用双换行分隔
   - 直接输出核心内容,不要前缀(如"扩写后:")`,
  };

  /**
   * 执行快捷动作（SSE 流式输出）
   */
  async executeQuickAction(dto: QuickActionDto, res: Response): Promise<void> {
    const { actionType, nodeId, context } = dto;
    
    this.logger.log(`执行快捷动作: ${actionType} on node ${nodeId}`);
    
    // 构建 System Prompt
    const systemPrompt = this.buildQuickActionPrompt(actionType);
    
    // 构建用户内容
    const userContent = this.buildQuickActionUserContent(actionType, context);
    
    // 如果没有 OpenAI 客户端，使用模拟输出
    if (!this.openai) {
      await this.streamMockQuickActionOutput(dto, res);
      return;
    }
    
    try {
      if (actionType === 'inline_rewrite') {
        // 原地重写：流式输出文本片段
        await this.executeInlineRewrite(dto, systemPrompt, userContent, res);
      } else {
        // 提取任务 / 结构化提炼：输出 JSON 节点
        await this.executeNodeGeneration(dto, systemPrompt, userContent, res);
      }
    } catch (error) {
      this.logger.error('Quick action error:', error);
      res.write(`data: ${JSON.stringify({
        event: 'error',
        data: {
          code: 'QUICK_ACTION_ERROR',
          message: error instanceof Error ? error.message : '快捷动作执行失败',
        },
      })}\n\n`);
      res.end();
    }
  }

  /**
   * 构建快捷动作的 System Prompt
   */
  private buildQuickActionPrompt(actionType: QuickActionType): string {
    const basePrompt = this.QUICK_ACTION_PROMPTS[actionType];
    
    // 替换日期占位符
    const today = new Date().toISOString().split('T')[0];
    return basePrompt.replace('{{today}}', today);
  }

  /**
   * 构建快捷动作的用户内容
   * v4.1.1: 简化为只使用当前节点内容
   */
  private buildQuickActionUserContent(
    actionType: QuickActionType,
    context: QuickActionDto['context'],
  ): string {
    // 只使用当前节点内容，不再添加兄弟和祖先信息
    return `请处理以下内容：\n\n${context.nodeContent}`;
  }

  /**
   * 执行原地重写（inline_rewrite）
   */
  private async executeInlineRewrite(
    dto: QuickActionDto,
    systemPrompt: string,
    userContent: string,
    res: Response,
  ): Promise<void> {
    const stream = await this.openai!.chat.completions.create({
      model: this.getAIModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      stream: true,
    });

    let fullContent = '';

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        
        // 发送增量替换事件
        const replaceEvent: QuickActionReplaceEvent = {
          event: 'replace',
          data: {
            nodeId: dto.nodeId,
            content: content,
            isFinal: false,
          },
        };
        res.write(`data: ${JSON.stringify(replaceEvent)}\n\n`);
      }
    }

    // 发送最终内容
    const finalReplaceEvent: QuickActionReplaceEvent = {
      event: 'replace',
      data: {
        nodeId: dto.nodeId,
        content: fullContent,
        isFinal: true,
      },
    };
    res.write(`data: ${JSON.stringify(finalReplaceEvent)}\n\n`);

    // 发送完成事件
    const doneEvent: QuickActionDoneEvent = {
      event: 'done',
      data: {
        success: true,
        nodeCount: 1,
        actionType: dto.actionType,
      },
    };
    res.write(`data: ${JSON.stringify(doneEvent)}\n\n`);
    res.end();
  }

  /**
   * 执行节点生成（extract_tasks / structured_summary）
   */
  private async executeNodeGeneration(
    dto: QuickActionDto,
    systemPrompt: string,
    userContent: string,
    res: Response,
  ): Promise<void> {
    const response = await this.openai!.chat.completions.create({
      model: this.getAIModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '[]';
    
    // 解析 JSON 响应
    let nodes: Array<{
      tempId: string;
      parentTempId: string | null;
      content: string;
      nodeType: 'text' | 'heading' | 'todo';
      supertagId?: string | null;
      fields?: Record<string, unknown>;
    }> = [];
    
    try {
      const parsed = JSON.parse(content);
      // 支持两种格式：直接数组或包装对象
      nodes = Array.isArray(parsed) ? parsed : (parsed.nodes || parsed.tasks || []);
    } catch (error) {
      this.logger.error('Failed to parse quick action response:', error);
      nodes = [];
    }

    // 逐个发送节点事件
    for (const node of nodes) {
      const nodeEvent: QuickActionNodeEvent = {
        event: 'node',
        data: {
          tempId: node.tempId,
          parentTempId: node.parentTempId,
          content: node.content,
          nodeType: node.nodeType,
          supertagId: node.supertagId || null,
          fields: node.fields || {},
        },
      };
      res.write(`data: ${JSON.stringify(nodeEvent)}\n\n`);
      
      // 模拟流式效果
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 发送完成事件
    const doneEvent: QuickActionDoneEvent = {
      event: 'done',
      data: {
        success: true,
        nodeCount: nodes.length,
        actionType: dto.actionType,
      },
    };
    res.write(`data: ${JSON.stringify(doneEvent)}\n\n`);
    res.end();
  }

  /**
   * 模拟快捷动作输出（无 OpenAI 时使用）
   */
  private async streamMockQuickActionOutput(
    dto: QuickActionDto,
    res: Response,
  ): Promise<void> {
    const { actionType, nodeId, context } = dto;
    
    if (actionType === 'inline_rewrite') {
      // 模拟原地重写
      const mockContent = `这是对「${context.nodeContent.slice(0, 50)}...」的专业扩写。\n\n经过深入分析，该内容涵盖以下要点：首先，需要明确核心目标和预期成果；其次，应当制定详细的执行计划和时间表；最后，建立有效的反馈机制以确保持续改进。`;
      
      const chunks = mockContent.match(/.{1,20}/g) || [];
      for (const chunk of chunks) {
        res.write(`data: ${JSON.stringify({
          event: 'replace',
          data: { nodeId, content: chunk, isFinal: false },
        })}\n\n`);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      res.write(`data: ${JSON.stringify({
        event: 'replace',
        data: { nodeId, content: mockContent, isFinal: true },
      })}\n\n`);
      
    } else if (actionType === 'extract_tasks') {
      // 模拟提取任务
      const mockTasks = [
        {
          tempId: 'task-1',
          parentTempId: null,
          content: '完成需求文档撰写',
          nodeType: 'todo' as const,
          supertagId: '任务',
          fields: { task_status: '待启动', due_date: null },
        },
        {
          tempId: 'task-2',
          parentTempId: null,
          content: '与前端确认技术方案',
          nodeType: 'todo' as const,
          supertagId: '任务',
          fields: { task_status: '待启动', due_date: null },
        },
      ];
      
      for (const task of mockTasks) {
        res.write(`data: ${JSON.stringify({ event: 'node', data: task })}\n\n`);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
    } else {
      // 模拟结构化提炼
      const mockNodes = [
        {
          tempId: 'node-1',
          parentTempId: null,
          content: '核心观点：系统架构设计',
          nodeType: 'heading' as const,
          supertagId: null,
          fields: {},
        },
        {
          tempId: 'node-2',
          parentTempId: 'node-1',
          content: '采用微服务架构提升系统可扩展性',
          nodeType: 'text' as const,
          supertagId: null,
          fields: {},
        },
        {
          tempId: 'node-3',
          parentTempId: 'node-1',
          content: '引入消息队列实现异步解耦',
          nodeType: 'text' as const,
          supertagId: null,
          fields: {},
        },
      ];
      
      for (const node of mockNodes) {
        res.write(`data: ${JSON.stringify({ event: 'node', data: node })}\n\n`);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // 发送完成事件
    res.write(`data: ${JSON.stringify({
      event: 'done',
      data: {
        success: true,
        nodeCount: actionType === 'inline_rewrite' ? 1 : (actionType === 'extract_tasks' ? 2 : 3),
        actionType,
      },
    })}\n\n`);
    res.end();
  }
}

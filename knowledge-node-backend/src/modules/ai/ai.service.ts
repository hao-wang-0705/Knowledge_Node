import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

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
    // 初始化 OpenAI 客户端
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const baseURL = this.configService.get<string>('OPENAI_BASE_URL');
    
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey,
        baseURL: baseURL || undefined,
      });
    } else {
      this.logger.warn('OPENAI_API_KEY not configured, AI features will be disabled');
    }
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
      // 调用 OpenAI 流式接口
      const stream = await this.openai.chat.completions.create({
        model: this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini',
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
}

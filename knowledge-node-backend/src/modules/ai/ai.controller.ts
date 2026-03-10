import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Res,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { AIService, AggregateRequestDto } from './ai.service';
import { ExecuteCommandDto } from './dto/command.dto';
import { QuickActionDto } from './dto/quick-action.dto';
import { NodesService } from '../nodes/nodes.service';

@Controller('api/ai')
export class AIController {
  constructor(
    private readonly aiService: AIService,
    private readonly nodesService: NodesService,
  ) {}

  /**
   * AI 聚合接口 - SSE 流式输出
   */
  @Post('aggregate')
  async aggregate(
    @Body() dto: AggregateRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    try {
      // 设置 SSE 响应头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      
      // 调用服务进行流式处理
      await this.aiService.streamAggregate(dto, res);
    } catch (error) {
      // 如果还没发送响应，返回错误
      if (!res.headersSent) {
        throw new HttpException(
          error instanceof Error ? error.message : 'AI 聚合失败',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      // 否则通过 SSE 发送错误
      res.write(
        `data: ${JSON.stringify({
          event: 'error',
          data: { code: 'AGGREGATE_ERROR', message: error instanceof Error ? error.message : 'Unknown error' },
        })}\n\n`,
      );
      res.end();
    }
  }

  /**
   * 获取缓存的 AI 聚合结果
   */
  @Get('aggregate-cache')
  async getAggregateCache(
    @Query('tagId') tagId: string,
    @Query('queryHash') queryHash: string,
  ) {
    if (!tagId || !queryHash) {
      throw new HttpException('缺少必要参数', HttpStatus.BAD_REQUEST);
    }

    const cache = await this.aiService.getCache(tagId, queryHash);
    
    if (!cache) {
      throw new HttpException('缓存不存在或已过期', HttpStatus.NOT_FOUND);
    }

    return {
      success: true,
      data: cache,
    };
  }

  /**
   * 删除缓存
   */
  @Post('aggregate-cache/invalidate')
  async invalidateCache(
    @Body() body: { tagId: string; queryHash?: string },
  ) {
    const { tagId, queryHash } = body;
    
    if (!tagId) {
      throw new HttpException('缺少 tagId', HttpStatus.BAD_REQUEST);
    }

    await this.aiService.invalidateCache(tagId, queryHash);

    return {
      success: true,
      message: '缓存已清除',
    };
  }

  // =========================================================================
  // v4.0: AI 指令节点执行接口
  // =========================================================================

  /**
   * 执行 AI 指令 - SSE 流式输出
   * POST /api/ai/command/execute
   */
  @Post('command/execute')
  async executeCommand(
    @Body() dto: ExecuteCommandDto,
    @Res() res: Response,
  ): Promise<void> {
    try {
      // 验证必要参数
      if (!dto.userId || !dto.nodeId || !dto.surface?.userPrompt) {
        throw new HttpException('缺少必要参数', HttpStatus.BAD_REQUEST);
      }

      console.log('[executeCommand] Request:', {
        userId: dto.userId,
        nodeId: dto.nodeId,
        parentNodeId: dto.parentNodeId,
        userPrompt: dto.surface.userPrompt.slice(0, 100),
      });

      // 设置 SSE 响应头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // 1. 首先执行意图分析获取 DSL
      const intentResult = await this.aiService.analyzeIntent(dto.surface.userPrompt);

      console.log('[executeCommand] Intent analysis result:', {
        category: intentResult.commandCategory,
        requiresContext: intentResult.requiresContext,
        contextQueryDSL: intentResult.contextQueryDSL,
      });

      // 2. 根据 DSL 查询上下文节点
      let contextNodes: Array<{ id: string; content: string; fields: Record<string, unknown> }> = [];
      
      if (intentResult.requiresContext && intentResult.contextQueryDSL) {
        const queryNodeId = dto.parentNodeId || dto.nodeId;
        console.log('[executeCommand] Querying context nodes with:', {
          dsl: intentResult.contextQueryDSL,
          queryNodeId,
        });

        contextNodes = await this.nodesService.queryNodesByDSL(
          dto.userId,
          intentResult.contextQueryDSL,
          queryNodeId,
        );

        console.log('[executeCommand] Found context nodes:', {
          count: contextNodes.length,
          nodeIds: contextNodes.map(n => n.id),
        });
      } else {
        console.log('[executeCommand] Skipping context query:', {
          requiresContext: intentResult.requiresContext,
          hasContextQueryDSL: !!intentResult.contextQueryDSL,
        });
      }

      // 3. 执行指令（流式输出）
      await this.aiService.executeCommand(dto, contextNodes, res);
    } catch (error) {
      console.error('[executeCommand] Error:', error);
      // 如果还没发送响应头，返回 HTTP 错误
      if (!res.headersSent) {
        throw new HttpException(
          error instanceof Error ? error.message : 'AI 指令执行失败',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      // 否则通过 SSE 发送错误
      res.write(
        `data: ${JSON.stringify({
          event: 'error',
          data: { 
            code: 'COMMAND_ERROR', 
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        })}\n\n`,
      );
      res.end();
    }
  }

  // =========================================================================
  // v4.1: 快捷动作执行接口
  // =========================================================================

  /**
   * 执行快捷动作 - SSE 流式输出
   * POST /api/ai/quick-action
   */
  @Post('quick-action')
  async executeQuickAction(
    @Body() dto: QuickActionDto,
    @Res() res: Response,
  ): Promise<void> {
    try {
      // 验证必要参数
      if (!dto.userId || !dto.nodeId || !dto.actionType || !dto.context?.nodeContent) {
        throw new HttpException('缺少必要参数', HttpStatus.BAD_REQUEST);
      }

      // 验证动作类型
      const validActionTypes = ['extract_tasks', 'structured_summary', 'inline_rewrite'];
      if (!validActionTypes.includes(dto.actionType)) {
        throw new HttpException('无效的动作类型', HttpStatus.BAD_REQUEST);
      }

      // 设置 SSE 响应头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // 执行快捷动作
      await this.aiService.executeQuickAction(dto, res);
    } catch (error) {
      // 如果还没发送响应头，返回 HTTP 错误
      if (!res.headersSent) {
        throw new HttpException(
          error instanceof Error ? error.message : '快捷动作执行失败',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      // 否则通过 SSE 发送错误
      res.write(
        `data: ${JSON.stringify({
          event: 'error',
          data: {
            code: 'QUICK_ACTION_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        })}\n\n`,
      );
      res.end();
    }
  }
}

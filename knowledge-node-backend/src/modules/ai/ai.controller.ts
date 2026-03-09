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

@Controller('api/ai')
export class AIController {
  constructor(private readonly aiService: AIService) {}

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
}

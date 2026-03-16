/**
 * Agent 控制器
 * 统一的 AI Agent API 入口
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import {
  IsString,
  IsOptional,
  IsObject,
  IsBoolean,
  IsNumber,
  IsIn,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AgentGateway } from './agent.gateway';
import {
  AgentRequest,
  QuickActionRequest,
  QuickActionType,
} from './interfaces';

/**
 * 节点上下文
 */
class NodeContext {
  @IsString()
  id!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsObject()
  fields?: Record<string, unknown>;
}

/**
 * 执行上下文
 */
class ExecuteContext {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NodeContext)
  nodes?: NodeContext[];

  @IsOptional()
  @IsObject()
  fields?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  selectedText?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * 模型配置
 */
class ModelConfig {
  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  maxTokens?: number;

  @IsOptional()
  @IsNumber()
  temperature?: number;
}

/**
 * 执行选项
 */
class ExecuteOptions {
  @IsOptional()
  @IsBoolean()
  stream?: boolean;

  @IsOptional()
  @IsNumber()
  maxSteps?: number;

  @IsOptional()
  @IsNumber()
  timeout?: number;

  @IsOptional()
  @IsString()
  forceTool?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ModelConfig)
  modelConfig?: ModelConfig;

  @IsOptional()
  @IsBoolean()
  includePlan?: boolean;
}

/**
 * Agent 执行请求 DTO
 */
class ExecuteDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  nodeId?: string;

  @IsString()
  prompt!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExecuteContext)
  context?: ExecuteContext;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExecuteOptions)
  options?: ExecuteOptions;
}

/**
 * 快捷动作请求 DTO
 */
class QuickActionDto {
  @IsString()
  userId!: string;

  @IsString()
  nodeId!: string;

  @IsString()
  @IsIn(['expand', 'deconstruct'])
  action!: QuickActionType;

  @IsOptional()
  @IsString()
  selectedContent?: string;

  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}

@Controller('api/agent')
export class AgentController {
  private readonly logger = new Logger(AgentController.name);

  constructor(private readonly agentGateway: AgentGateway) {}

  /**
   * 执行 Agent 请求（自动判断流式/非流式）
   * POST /api/agent/execute
   */
  @Post('execute')
  async execute(
    @Body() dto: ExecuteDto,
    @Res() res: Response,
  ): Promise<void> {
    // 参数验证
    if (!dto.userId) {
      throw new HttpException('userId 不能为空', HttpStatus.BAD_REQUEST);
    }
    if (!dto.prompt) {
      throw new HttpException('prompt 不能为空', HttpStatus.BAD_REQUEST);
    }

    const request: AgentRequest = {
      userId: dto.userId,
      nodeId: dto.nodeId,
      prompt: dto.prompt,
      context: dto.context,
      options: dto.options,
    };

    // 判断是否流式输出
    if (dto.options?.stream !== false) {
      // 默认流式输出
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      await this.agentGateway.executeStream(request, res);
    } else {
      // 非流式输出
      const result = await this.agentGateway.execute(request);
      res.json(result);
    }
  }

  /**
   * 执行快捷动作（流式输出）
   * POST /api/agent/quick-action
   */
  @Post('quick-action')
  async quickAction(
    @Body() dto: QuickActionDto,
    @Res() res: Response,
  ): Promise<void> {
    // 参数验证
    if (!dto.userId) {
      throw new HttpException('userId 不能为空', HttpStatus.BAD_REQUEST);
    }
    if (!dto.nodeId) {
      throw new HttpException('nodeId 不能为空', HttpStatus.BAD_REQUEST);
    }
    if (!dto.action) {
      throw new HttpException('action 不能为空', HttpStatus.BAD_REQUEST);
    }

    const validActions: QuickActionType[] = ['expand', 'deconstruct'];
    if (!validActions.includes(dto.action)) {
      throw new HttpException(
        `无效的 action，支持: ${validActions.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const request: QuickActionRequest = {
      userId: dto.userId,
      nodeId: dto.nodeId,
      action: dto.action,
      selectedContent: dto.selectedContent,
      params: dto.params,
    };

    // 设置 SSE 头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    await this.agentGateway.executeQuickAction(request, res);
  }

  /**
   * 获取可用工具列表
   * GET /api/agent/tools
   */
  @Get('tools')
  getTools() {
    return {
      success: true,
      tools: this.agentGateway.getAvailableTools(),
    };
  }

  /**
   * 健康检查
   * GET /api/agent/health
   */
  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

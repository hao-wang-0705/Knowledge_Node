import { IsString, IsOptional, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 指令分类
 * - web_search: 联网搜索，调用 Google Search grounding 获取实时信息
 */
export type CommandCategory = 'productivity' | 'analysis' | 'creative' | 'summary' | 'search' | 'expansion' | 'web_search';

/**
 * 上下文查询 DSL
 */
export interface ContextQueryDSL {
  tags?: string[];
  dateRange?: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | string;
  scope?: 'relative' | 'global';
  ancestorId?: string;
  depth?: number;
  keywords?: string[];
}

/**
 * 意图分析结果
 */
export interface IntentAnalysisResult {
  commandCategory: CommandCategory;
  requiresContext: boolean;
  contextQueryDSL?: ContextQueryDSL;
  systemPrompt: string;
  actionStrategy: 'append_children' | 'replace_content' | 'create_sibling';
}

/**
 * 指令表层配置（用户输入）
 */
export class CommandSurfaceDto {
  @IsString()
  name: string;

  @IsString()
  userPrompt: string;
}

/**
 * 执行指令请求 DTO
 */
export class ExecuteCommandDto {
  @IsString()
  userId: string;

  @IsString()
  nodeId: string;

  @ValidateNested()
  @Type(() => CommandSurfaceDto)
  surface: CommandSurfaceDto;

  @IsOptional()
  @IsString()
  parentNodeId?: string;

  @IsOptional()
  @IsBoolean()
  autoExecute?: boolean;
}

/**
 * 指令执行 SSE 事件类型
 */
export type CommandEventType = 'intent' | 'context' | 'chunk' | 'node' | 'done' | 'error';

/**
 * 意图分析完成事件
 */
export interface CommandIntentEvent {
  event: 'intent';
  data: {
    category: CommandCategory;
    requiresContext: boolean;
    contextDescription: string;
  };
}

/**
 * 上下文获取事件
 */
export interface CommandContextEvent {
  event: 'context';
  data: {
    nodeCount: number;
    tokenEstimate: number;
  };
}

/**
 * 文本片段事件
 */
export interface CommandChunkEvent {
  event: 'chunk';
  data: {
    text: string;
  };
}

/**
 * 节点生成事件
 */
export interface CommandNodeEvent {
  event: 'node';
  data: {
    tempId: string;
    parentTempId: string | null;
    content: string;
  };
}

/**
 * 完成事件
 */
export interface CommandDoneEvent {
  event: 'done';
  data: {
    success: boolean;
    nodeCount: number;
    coreConfig: IntentAnalysisResult;
  };
}

/**
 * 错误事件
 */
export interface CommandErrorEvent {
  event: 'error';
  data: {
    code: string;
    message: string;
  };
}

/**
 * 指令执行 SSE 事件联合类型
 */
export type CommandEvent =
  | CommandIntentEvent
  | CommandContextEvent
  | CommandChunkEvent
  | CommandNodeEvent
  | CommandDoneEvent
  | CommandErrorEvent;

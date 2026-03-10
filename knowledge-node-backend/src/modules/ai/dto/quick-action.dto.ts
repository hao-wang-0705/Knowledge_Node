import { IsString, IsOptional, IsObject, IsIn } from 'class-validator';

/**
 * 快捷动作类型
 */
export type QuickActionType = 'extract_tasks' | 'structured_summary' | 'inline_rewrite';

/**
 * 快捷动作上下文
 */
export interface QuickActionContext {
  /** 当前节点内容 */
  nodeContent: string;
  /** 兄弟节点内容（上下文） */
  siblings?: string[];
  /** 祖先节点内容（路径） */
  ancestors?: string[];
}

/**
 * 快捷动作请求 DTO
 */
export class QuickActionDto {
  @IsString()
  userId: string;

  @IsString()
  nodeId: string;

  @IsString()
  @IsIn(['extract_tasks', 'structured_summary', 'inline_rewrite'])
  actionType: QuickActionType;

  @IsObject()
  context: QuickActionContext;
}

// =============================================================================
// SSE 事件类型
// =============================================================================

/**
 * 节点创建事件
 */
export interface QuickActionNodeEvent {
  event: 'node';
  data: {
    tempId: string;
    parentTempId: string | null;
    content: string;
    nodeType: 'text' | 'heading' | 'todo';
    supertagId?: string | null;
    fields?: Record<string, unknown>;
  };
}

/**
 * 内容替换事件（仅 inline_rewrite）
 */
export interface QuickActionReplaceEvent {
  event: 'replace';
  data: {
    nodeId: string;
    content: string;
    isFinal?: boolean;
  };
}

/**
 * 完成事件
 */
export interface QuickActionDoneEvent {
  event: 'done';
  data: {
    success: boolean;
    nodeCount: number;
    actionType: QuickActionType;
  };
}

/**
 * 错误事件
 */
export interface QuickActionErrorEvent {
  event: 'error';
  data: {
    code: string;
    message: string;
  };
}

/**
 * SSE 事件联合类型
 */
export type QuickActionEvent =
  | QuickActionNodeEvent
  | QuickActionReplaceEvent
  | QuickActionDoneEvent
  | QuickActionErrorEvent;

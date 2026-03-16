/**
 * 行动标签状态机配置类型（与 preset-tags.json 中 type: "status" 的 statusConfig 一致）
 */
export interface StatusConfig {
  states: string[];
  initial: string;
  /** 完成态（如 todo 的 Done） */
  doneState?: string;
  /** 阻塞态（如 todo 的 Locked） */
  blockedStates?: string[];
  /** 可执行态（如 todo 的 Ready） */
  unblockedStates?: string[];
  /** 解决态（如卡点的 Resolved，用于 BLOCKS 前置是否“已解除”） */
  resolvedState?: string;
  /** 事件 -> 当前状态 -> 下一状态 */
  transitions?: Record<string, Record<string, string>>;
}

export interface StatusFieldInfo {
  fieldKey: string;
  config: StatusConfig;
}

/** 从 fieldDefinitions 中解析出的单条 status 字段定义 */
export interface StatusFieldDefinition {
  id: string;
  key: string;
  name?: string;
  type: 'status';
  statusConfig: StatusConfig;
}

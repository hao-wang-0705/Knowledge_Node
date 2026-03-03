/**
 * 查询面板类型定义（常驻模式）
 * 用于右侧查询面板软分屏功能
 */

/**
 * 查询块状态
 */
export type QueryBlockStatus = 'idle' | 'loading' | 'done' | 'error';

/**
 * 查询块
 * nodes 存储真实节点的 ID 列表，NodeComponent 从 nodeStore 获取完整数据
 */
export interface QueryBlock {
  id: string;
  queryText: string;
  /** 节点 ID 列表（仅存储顶层节点，子节点由 NodeComponent 递归渲染） */
  nodes: string[];
  status: QueryBlockStatus;
  createdAt: number;
  updatedAt?: number;
}

/**
 * 查询面板状态（常驻模式，移除 isOpen）
 */
export interface QueryPanelState {
  /** 查询块列表 */
  queries: QueryBlock[];
  /** 面板宽度（像素） */
  panelWidth: number;
}

/**
 * 查询面板操作（常驻模式，移除开关操作）
 */
export interface QueryPanelActions {
  /** 添加查询块（返回新块 ID，达到上限返回 null） */
  addQueryBlock: (queryText?: string) => string | null;
  /** 更新查询块 */
  updateQueryBlock: (id: string, updates: Partial<QueryBlock>) => void;
  /** 删除查询块 */
  deleteQueryBlock: (id: string) => void;
  /** 设置面板宽度 */
  setPanelWidth: (width: number) => void;
  /** 初始化 Mock 数据 */
  initMockData: () => void;
}

/**
 * 查询面板 Store 类型
 */
export type QueryPanelStore = QueryPanelState & QueryPanelActions;

/**
 * 查询面板常量
 */
export const QUERY_PANEL_CONSTANTS = {
  /** 默认面板宽度 */
  DEFAULT_WIDTH: 380,
  /** 最小面板宽度 */
  MIN_WIDTH: 320,
  /** 最大面板宽度 */
  MAX_WIDTH: 600,
  /** 最大查询块数量 */
  MAX_QUERY_BLOCKS: 3,
} as const;

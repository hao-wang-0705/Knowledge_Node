/**
 * 查询面板类型定义
 * v3.6: 重构为读写 search_root 子节点，移除 localStorage Mock
 */

import type { Node } from './index';
import type { SearchConfig } from './search';

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
  /** 最大搜索节点数量 */
  MAX_SEARCH_NODES: 3,
} as const;

/**
 * 查询面板状态
 */
export interface QueryPanelState {
  /** search_root 下的搜索节点 ID 列表 */
  searchNodeIds: string[];
  /** 面板宽度（像素） */
  panelWidth: number;
  /** 是否已从 localStorage 同步面板宽度 */
  _hydrated?: boolean;
  /** 是否正在加载 */
  isLoading: boolean;
}

/**
 * 查询面板操作
 */
export interface QueryPanelActions {
  /** 从 nodeStore 加载 search_root 下的搜索节点 */
  loadSearchNodes: () => void;
  /** 添加搜索节点（返回节点 ID，达到上限返回 null） */
  addSearchNode: (config?: SearchConfig) => string | null;
  /** 删除搜索节点 */
  removeSearchNode: (id: string) => void;
  /** 设置面板宽度 */
  setPanelWidth: (width: number) => void;
  /** 从 localStorage 同步面板宽度（客户端挂载时调用） */
  hydratePanelWidth: () => void;
  /** 获取搜索节点数据 */
  getSearchNode: (id: string) => Node | undefined;
  /** 检查是否可以添加更多搜索节点 */
  canAddMore: () => boolean;
}

/**
 * 查询面板 Store 类型
 */
export type QueryPanelStore = QueryPanelState & QueryPanelActions;

/**
 * 工具函数：从搜索节点提取 SearchConfig
 */
export function getSearchConfigFromNode(node: Node | undefined): SearchConfig | undefined {
  if (!node || node.type !== 'search') return undefined;
  return node.payload as SearchConfig | undefined;
}

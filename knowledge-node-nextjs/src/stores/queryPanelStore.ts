import { create } from 'zustand';
import { useNodeStore } from '@/stores/nodeStore';
import type { SearchConfig } from '@/types/search';
import type { Node } from '@/types';

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
 * 从 localStorage 读取面板宽度
 */
const getStoredPanelWidth = (): number => {
  if (typeof window === 'undefined') return QUERY_PANEL_CONSTANTS.DEFAULT_WIDTH;
  
  const stored = localStorage.getItem('queryPanelWidth');
  if (stored) {
    const width = parseInt(stored, 10);
    if (!isNaN(width) && width >= QUERY_PANEL_CONSTANTS.MIN_WIDTH && width <= QUERY_PANEL_CONSTANTS.MAX_WIDTH) {
      return width;
    }
  }
  return QUERY_PANEL_CONSTANTS.DEFAULT_WIDTH;
};

/**
 * 查询面板状态
 */
interface QueryPanelState {
  /** search_root 下的搜索节点 ID 列表 */
  searchNodeIds: string[];
  /** 面板宽度（像素） */
  panelWidth: number;
  /** 是否已从 localStorage 同步面板宽度 */
  _hydrated: boolean;
  /** 是否正在加载 */
  isLoading: boolean;
}

/**
 * 查询面板操作
 */
interface QueryPanelActions {
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
 * 查询面板 Store
 * 管理智能查询面板中 search_root 下的搜索节点
 */
export const useQueryPanelStore = create<QueryPanelStore>((set, get) => ({
  // ========== 初始状态 ==========
  searchNodeIds: [],
  panelWidth: QUERY_PANEL_CONSTANTS.DEFAULT_WIDTH,
  _hydrated: false,
  isLoading: false,

  // ========== 搜索节点操作 ==========
  
  /**
   * 从 nodeStore 加载 search_root 下的搜索节点
   */
  loadSearchNodes: () => {
    const nodeStore = useNodeStore.getState();
    const searchRootId = nodeStore.getSearchRootId();
    
    if (!searchRootId) {
      console.warn('[QueryPanelStore] search_root 不存在');
      set({ searchNodeIds: [], isLoading: false });
      return;
    }
    
    const searchRoot = nodeStore.nodes[searchRootId];
    if (!searchRoot) {
      set({ searchNodeIds: [], isLoading: false });
      return;
    }
    
    // 获取 search_root 下的所有搜索节点（nodeType === 'search'）
    const searchNodeIds = searchRoot.childrenIds.filter((childId) => {
      const child = nodeStore.nodes[childId];
      return child && child.type === 'search';
    });
    
    set({ searchNodeIds, isLoading: false });
  },

  /**
   * 添加搜索节点
   * @param config 搜索配置
   * @returns 新节点 ID，达到上限返回 null
   */
  addSearchNode: (config?: SearchConfig) => {
    const { searchNodeIds } = get();
    
    // 检查是否达到上限
    if (searchNodeIds.length >= QUERY_PANEL_CONSTANTS.MAX_SEARCH_NODES) {
      return null;
    }
    
    const nodeStore = useNodeStore.getState();
    const searchRootId = nodeStore.getSearchRootId();
    
    if (!searchRootId) {
      console.error('[QueryPanelStore] search_root 不存在，无法创建搜索节点');
      return null;
    }
    
    // 使用 nodeStore 的 addSearchNode 方法创建搜索节点
    const defaultConfig: SearchConfig = config || {
      conditions: [],
      logicalOperator: 'AND',
      label: '新搜索',
    };
    
    const newNodeId = nodeStore.addSearchNode(searchRootId, defaultConfig);
    
    // 更新本地状态
    set({ searchNodeIds: [...searchNodeIds, newNodeId] });
    
    return newNodeId;
  },

  /**
   * 删除搜索节点
   */
  removeSearchNode: (id: string) => {
    const { searchNodeIds } = get();
    const nodeStore = useNodeStore.getState();
    
    // 从 nodeStore 删除节点
    nodeStore.deleteNode(id);
    
    // 更新本地状态
    set({ searchNodeIds: searchNodeIds.filter((nodeId) => nodeId !== id) });
  },

  /**
   * 设置面板宽度（带边界限制和持久化）
   */
  setPanelWidth: (width: number) => {
    const clampedWidth = Math.max(
      QUERY_PANEL_CONSTANTS.MIN_WIDTH,
      Math.min(QUERY_PANEL_CONSTANTS.MAX_WIDTH, width)
    );
    set({ panelWidth: clampedWidth });
    
    // 持久化到 localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('queryPanelWidth', String(clampedWidth));
    }
  },

  /**
   * 从 localStorage 同步面板宽度
   * 客户端挂载后调用，避免 SSR hydration mismatch
   */
  hydratePanelWidth: () => {
    const { _hydrated } = get();
    if (_hydrated) return;
    
    if (typeof window !== 'undefined') {
      const storedWidth = getStoredPanelWidth();
      set({ panelWidth: storedWidth, _hydrated: true });
    }
  },

  /**
   * 获取搜索节点数据
   */
  getSearchNode: (id: string) => {
    const nodeStore = useNodeStore.getState();
    return nodeStore.nodes[id];
  },

  /**
   * 检查是否可以添加更多搜索节点
   */
  canAddMore: () => {
    const { searchNodeIds } = get();
    return searchNodeIds.length < QUERY_PANEL_CONSTANTS.MAX_SEARCH_NODES;
  },
}));

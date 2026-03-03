import { create } from 'zustand';
import { 
  QueryPanelStore, 
  QueryBlock, 
  QUERY_PANEL_CONSTANTS 
} from '@/types/query';
import { useNodeStore } from '@/stores/nodeStore';

/**
 * 生成唯一 ID
 */
const generateId = (): string => {
  return `query_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

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
 * Mock 查询逻辑 - 从 nodeStore 筛选真实节点
 * 根据查询条件从真实节点中筛选，返回节点 ID 列表
 */
const mockQueryNodes = (queryText: string): string[] => {
  const nodeStore = useNodeStore.getState();
  const allNodes = nodeStore.nodes;
  
  // 将查询文本转为小写进行匹配
  const queryLower = queryText.toLowerCase();
  
  // 筛选匹配的节点 ID
  const matchedIds: string[] = [];
  
  Object.entries(allNodes).forEach(([nodeId, node]) => {
    if (!node) return;
    
    // 跳过系统节点（日历根节点、用户根节点等）
    if (node.nodeRole && node.nodeRole !== 'normal') return;
    
    // 内容匹配
    const contentMatch = node.content?.toLowerCase().includes(queryLower);
    
    // 标签匹配 - 检查节点的标签 ID 是否包含查询词
    const tagMatch = node.tags?.some(tagId => 
      tagId.toLowerCase().includes(queryLower)
    );
    
    if (contentMatch || tagMatch) {
      matchedIds.push(nodeId);
    }
  });
  
  // 限制返回数量，避免过多
  return matchedIds.slice(0, 10);
};

/**
 * 初始化 Mock 查询块 - 使用真实节点数据
 */
const createMockQueries = (): QueryBlock[] => {
  const nodeStore = useNodeStore.getState();
  const allNodes = nodeStore.nodes;
  
  // 找到一些有内容的真实节点作为示例
  const sampleNodeIds: string[] = [];
  
  Object.entries(allNodes).forEach(([nodeId, node]) => {
    if (!node) return;
    // 跳过系统节点和空内容节点
    if (node.nodeRole && node.nodeRole !== 'normal') return;
    if (!node.content || node.content.trim() === '') return;
    // 跳过根节点
    if (nodeId === 'user_root' || nodeId === 'daily_root') return;
    
    if (sampleNodeIds.length < 6) {
      sampleNodeIds.push(nodeId);
    }
  });
  
  // 如果找不到真实节点，返回空查询块
  if (sampleNodeIds.length === 0) {
    return [{
      id: 'q1',
      queryText: '示例查询',
      status: 'done',
      createdAt: Date.now(),
      nodes: [],
    }];
  }
  
  // 分成两组创建示例查询块
  const firstGroup = sampleNodeIds.slice(0, 3);
  const secondGroup = sampleNodeIds.slice(3, 6);
  
  const queries: QueryBlock[] = [];
  
  if (firstGroup.length > 0) {
    queries.push({
      id: 'q1',
      queryText: '最近的笔记',
      status: 'done',
      createdAt: Date.now() - 3600000,
      nodes: firstGroup,
    });
  }
  
  if (secondGroup.length > 0) {
    queries.push({
      id: 'q2',
      queryText: '相关内容',
      status: 'done',
      createdAt: Date.now() - 7200000,
      nodes: secondGroup,
    });
  }
  
  return queries;
};

/**
 * 查询面板 Store（常驻模式）
 * 管理查询块列表和面板宽度，移除 isOpen 状态
 */
export const useQueryPanelStore = create<QueryPanelStore>((set, get) => ({
  // ========== 初始状态 ==========
  queries: [],
  panelWidth: typeof window !== 'undefined' ? getStoredPanelWidth() : QUERY_PANEL_CONSTANTS.DEFAULT_WIDTH,

  // ========== 查询块操作 ==========
  
  /**
   * 添加查询块
   * @param queryText 初始查询文本
   * @returns 新块 ID，达到上限返回 null
   */
  addQueryBlock: (queryText?: string) => {
    const { queries } = get();
    
    // 检查是否达到上限
    if (queries.length >= QUERY_PANEL_CONSTANTS.MAX_QUERY_BLOCKS) {
      return null;
    }
    
    // 如果有查询文本，执行 Mock 查询
    const nodes = queryText ? mockQueryNodes(queryText) : [];
    
    const newBlock: QueryBlock = {
      id: generateId(),
      queryText: queryText || '',
      nodes,
      status: queryText ? 'done' : 'idle',
      createdAt: Date.now(),
    };
    
    set({ queries: [...queries, newBlock] });
    return newBlock.id;
  },

  /**
   * 更新查询块
   */
  updateQueryBlock: (id: string, updates: Partial<QueryBlock>) => {
    const { queries } = get();
    
    // 如果更新了查询文本，重新执行 Mock 查询
    let finalUpdates = { ...updates };
    if (updates.queryText !== undefined) {
      finalUpdates.nodes = mockQueryNodes(updates.queryText);
      finalUpdates.status = 'done';
    }
    
    set({
      queries: queries.map((q) =>
        q.id === id ? { ...q, ...finalUpdates, updatedAt: Date.now() } : q
      ),
    });
  },

  /**
   * 删除查询块
   */
  deleteQueryBlock: (id: string) => {
    const { queries } = get();
    set({ queries: queries.filter((q) => q.id !== id) });
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
   * 初始化 Mock 数据 - 从真实节点中筛选
   */
  initMockData: () => {
    const mockQueries = createMockQueries();
    set({ queries: mockQueries });
  },
}));

// 导出常量供外部使用
export { QUERY_PANEL_CONSTANTS };

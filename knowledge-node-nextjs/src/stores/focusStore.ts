import { create } from 'zustand';
import { Node, TagTemplate, FieldDefinition } from '@/types';

// ============================================================================
// 聚焦模式状态管理 (v3.7)
// 用于超级标签聚焦页面的状态管理
// ============================================================================

export interface FocusState {
  /** 当前聚焦的标签 ID */
  focusedTagId: string | null;
  
  /** 当前聚焦的标签信息 */
  focusedTag: TagTemplate | null;
  
  /** 标签下的节点列表 */
  nodes: Node[];
  
  /** 选中的节点 ID（用于焦点面板） */
  selectedNodeId: string | null;
  
  /** 焦点面板是否打开 */
  isPanelOpen: boolean;
  
  /** 加载状态 */
  isLoading: boolean;
  
  /** 是否已初始化 */
  isInitialized: boolean;
  
  /** 错误信息 */
  error: string | null;
  
  /** 折叠的节点 ID 集合 */
  collapsedNodeIds: Set<string>;
}

export interface FocusActions {
  /** 进入聚焦模式 */
  enterFocus: (tagId: string, tag: TagTemplate) => Promise<void>;
  
  /** 退出聚焦模式 */
  exitFocus: () => void;
  
  /** 选中节点（打开焦点面板） */
  selectNode: (nodeId: string | null) => void;
  
  /** 切换节点折叠状态 */
  toggleCollapse: (nodeId: string) => void;
  
  /** 刷新节点列表 */
  refreshNodes: () => Promise<void>;
  
  /** 快捷创建节点 */
  quickCreate: (content: string) => Promise<Node | null>;
  
  /** 更新节点字段 */
  updateNodeFields: (nodeId: string, fields: Record<string, unknown>) => Promise<void>;
  
  /** 更新本地节点（乐观更新） */
  updateLocalNode: (nodeId: string, updates: Partial<Node>) => void;
  
  /** 重置 Store */
  reset: () => void;
}

type FocusStore = FocusState & FocusActions;

const initialState: FocusState = {
  focusedTagId: null,
  focusedTag: null,
  nodes: [],
  selectedNodeId: null,
  isPanelOpen: false,
  isLoading: false,
  isInitialized: false,
  error: null,
  collapsedNodeIds: new Set(),
};

export const useFocusStore = create<FocusStore>((set, get) => ({
  ...initialState,

  // ============================================
  // 进入聚焦模式
  // ============================================
  enterFocus: async (tagId: string, tag: TagTemplate) => {
    const { focusedTagId, isLoading } = get();
    
    // 防止重复加载
    if (focusedTagId === tagId && get().isInitialized) {
      return;
    }
    
    if (isLoading) {
      return;
    }
    
    set({
      focusedTagId: tagId,
      focusedTag: tag,
      isLoading: true,
      error: null,
      selectedNodeId: null,
      isPanelOpen: false,
    });
    
    try {
      const response = await fetch(`/api/nodes/supertag/${tagId}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '获取节点失败');
      }
      
      // 转换节点数据
      const nodes: Node[] = (result.data || []).map((node: any) => ({
        id: node.id,
        content: node.content || '',
        nodeType: node.type || 'text',
        parentId: node.parentId || null,
        childrenIds: node.childrenIds || [],
        isCollapsed: node.isCollapsed ?? false,
        tags: node.tags || [],
        references: node.references || [],
        supertagId: node.supertagId || null,
        fields: node.fields || {},
        payload: node.payload || {},
        sortOrder: node.sortOrder || 0,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      }));
      
      set({
        nodes,
        isLoading: false,
        isInitialized: true,
        error: null,
      });
      
      console.log(`[focusStore] 加载了 ${nodes.length} 个节点 (标签: ${tag.name})`);
    } catch (error) {
      console.error('[focusStore] enterFocus 错误:', error);
      set({
        isLoading: false,
        isInitialized: true,
        error: error instanceof Error ? error.message : '加载失败',
      });
    }
  },

  // ============================================
  // 退出聚焦模式
  // ============================================
  exitFocus: () => {
    set(initialState);
  },

  // ============================================
  // 选中节点
  // ============================================
  selectNode: (nodeId: string | null) => {
    set({
      selectedNodeId: nodeId,
      isPanelOpen: nodeId !== null,
    });
  },

  // ============================================
  // 切换折叠状态
  // ============================================
  toggleCollapse: (nodeId: string) => {
    set((state) => {
      const newCollapsed = new Set(state.collapsedNodeIds);
      if (newCollapsed.has(nodeId)) {
        newCollapsed.delete(nodeId);
      } else {
        newCollapsed.add(nodeId);
      }
      return { collapsedNodeIds: newCollapsed };
    });
  },

  // ============================================
  // 刷新节点列表
  // ============================================
  refreshNodes: async () => {
    const { focusedTagId, focusedTag } = get();
    if (!focusedTagId || !focusedTag) {
      return;
    }
    
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`/api/nodes/supertag/${focusedTagId}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '获取节点失败');
      }
      
      const nodes: Node[] = (result.data || []).map((node: any) => ({
        id: node.id,
        content: node.content || '',
        nodeType: node.type || 'text',
        parentId: node.parentId || null,
        childrenIds: node.childrenIds || [],
        isCollapsed: node.isCollapsed ?? false,
        tags: node.tags || [],
        references: node.references || [],
        supertagId: node.supertagId || null,
        fields: node.fields || {},
        payload: node.payload || {},
        sortOrder: node.sortOrder || 0,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      }));
      
      set({
        nodes,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('[focusStore] refreshNodes 错误:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : '刷新失败',
      });
    }
  },

  // ============================================
  // 快捷创建节点
  // ============================================
  quickCreate: async (content: string) => {
    const { focusedTagId, focusedTag, nodes } = get();
    
    if (!focusedTagId || !content.trim()) {
      return null;
    }
    
    try {
      const response = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: content.trim(),
          supertagId: focusedTagId,
          fields: {},
        }),
      });
      
      if (!response.ok) {
        throw new Error(`创建失败: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '创建节点失败');
      }
      
      const newNode: Node = {
        id: result.data.id,
        content: result.data.content || content.trim(),
        type: result.data.type || 'text',
        parentId: result.data.parentId || null,
        childrenIds: result.data.childrenIds || [],
        isCollapsed: false,
        tags: result.data.tags || [],
        references: result.data.references || [],
        supertagId: result.data.supertagId || focusedTagId,
        fields: result.data.fields || {},
        payload: result.data.payload || {},
        createdAt: result.data.createdAt,
        updatedAt: result.data.updatedAt,
      };
      
      // 乐观更新：将新节点添加到列表顶部
      set({
        nodes: [newNode, ...nodes],
      });
      
      console.log(`[focusStore] 创建节点成功: ${newNode.id}`);
      
      // 后台刷新以获取完整数据（包括模板展开的子节点）
      setTimeout(() => {
        get().refreshNodes();
      }, 500);
      
      return newNode;
    } catch (error) {
      console.error('[focusStore] quickCreate 错误:', error);
      throw error;
    }
  },

  // ============================================
  // 更新节点字段
  // ============================================
  updateNodeFields: async (nodeId: string, fields: Record<string, unknown>) => {
    const { nodes } = get();
    const node = nodes.find((n) => n.id === nodeId);
    
    if (!node) {
      return;
    }
    
    // 乐观更新
    const updatedFields = { ...node.fields, ...fields };
    get().updateLocalNode(nodeId, { fields: updatedFields });
    
    try {
      const response = await fetch(`/api/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fields: updatedFields }),
      });
      
      if (!response.ok) {
        // 回滚
        get().updateLocalNode(nodeId, { fields: node.fields });
        throw new Error(`更新失败: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        // 回滚
        get().updateLocalNode(nodeId, { fields: node.fields });
        throw new Error(result.error || '更新字段失败');
      }
    } catch (error) {
      console.error('[focusStore] updateNodeFields 错误:', error);
      throw error;
    }
  },

  // ============================================
  // 更新本地节点（乐观更新）
  // ============================================
  updateLocalNode: (nodeId: string, updates: Partial<Node>) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, ...updates } : node
      ),
    }));
  },

  // ============================================
  // 重置 Store
  // ============================================
  reset: () => {
    set(initialState);
  },
}));

// ============================================================================
// 选择器 Hooks
// ============================================================================

/** 获取当前聚焦的标签字段定义 */
export function useFieldDefinitions(): FieldDefinition[] {
  const focusedTag = useFocusStore((state) => state.focusedTag);
  return focusedTag?.fieldDefinitions ?? [];
}

/** 获取选中的节点 */
export function useSelectedNode(): Node | null {
  const selectedNodeId = useFocusStore((state) => state.selectedNodeId);
  const nodes = useFocusStore((state) => state.nodes);
  return selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) || null : null;
}

/** 检查节点是否折叠 */
export function useIsNodeCollapsed(nodeId: string): boolean {
  const collapsedNodeIds = useFocusStore((state) => state.collapsedNodeIds);
  return collapsedNodeIds.has(nodeId);
}

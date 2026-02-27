import { create } from 'zustand';
import { Notebook, NavigationMode } from '@/types';
import { useNodeStore } from './nodeStore';
import { notebooksApi, AuthenticationError } from '@/services/api';

interface NotebookStoreState {
  notebooks: Record<string, Notebook>;
  notebookIds: string[];  // 有序的笔记本 ID 列表
  activeNotebookId: string | null;  // 当前激活的笔记本
  navigationMode: NavigationMode;   // 当前导航模式
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}

interface NotebookStoreActions {
  // 笔记本操作（API 同步）
  createNotebook: (name?: string) => Promise<string | null>;
  updateNotebook: (id: string, updates: Partial<Notebook>) => Promise<void>;
  deleteNotebook: (id: string) => Promise<void>;
  
  // 导航操作
  setActiveNotebook: (id: string | null) => void;
  setNavigationMode: (mode: NavigationMode) => void;
  goToCalendar: () => void;
  
  // 数据加载（从数据库）
  loadFromAPI: () => Promise<void>;
  
  // 兼容旧接口（已废弃，保留以避免破坏性更改）
  loadFromStorage: () => void;
  saveToStorage: () => void;
  initWithMockData: () => void;
}

type NotebookStore = NotebookStoreState & NotebookStoreActions;

export const useNotebookStore = create<NotebookStore>((set, get) => ({
  notebooks: {},
  notebookIds: [],
  activeNotebookId: null,
  navigationMode: 'calendar',
  isLoading: false,
  isInitialized: false,
  error: null,

  // ============================================
  // 从 API 加载数据
  // ============================================
  loadFromAPI: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const notebooks = await notebooksApi.getAll();
      
      const notebooksMap: Record<string, Notebook> = {};
      const notebookIds: string[] = [];
      
      notebooks.forEach((nb) => {
        notebooksMap[nb.id] = {
          id: nb.id,
          name: nb.name,
          icon: nb.icon,
          rootNodeId: nb.rootNodeId,
          createdAt: nb.createdAt,
          updatedAt: nb.updatedAt,
        };
        notebookIds.push(nb.id);
      });
      
      set({ 
        notebooks: notebooksMap, 
        notebookIds, 
        isLoading: false, 
        isInitialized: true,
        error: null 
      });
      
      console.log(`[notebookStore] 从 API 加载了 ${notebookIds.length} 个笔记本`);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        set({ error: '认证失败，请重新登录', isLoading: false, isInitialized: false });
        throw error;
      }
      
      console.error('[notebookStore] 从 API 加载失败:', error);
      set({ 
        error: error instanceof Error ? error.message : '加载失败',
        isLoading: false,
        isInitialized: true,
        notebooks: {},
        notebookIds: []
      });
    }
  },

  // ============================================
  // 创建笔记本（API 同步）
  // ============================================
  createNotebook: async (name = '无标题笔记本') => {
    try {
      // 调用 API 创建笔记本（API 会同时创建根节点）
      const notebook = await notebooksApi.create({ name });
      
      const newNotebook: Notebook = {
        id: notebook.id,
        name: notebook.name,
        icon: notebook.icon,
        rootNodeId: notebook.rootNodeId,
        createdAt: notebook.createdAt,
        updatedAt: notebook.updatedAt,
      };

      set((state) => ({
        notebooks: { ...state.notebooks, [notebook.id]: newNotebook },
        notebookIds: [...state.notebookIds, notebook.id],
        activeNotebookId: notebook.id,
        navigationMode: 'notebook' as NavigationMode,
      }));

      // 设置 hoisted 到新笔记本的根节点
      const nodeStore = useNodeStore.getState();
      
      // 确保节点存储中有这个根节点（从数据库重新加载）
      await nodeStore.loadFromAPI?.();
      nodeStore.setHoistedNode(notebook.rootNodeId);
      
      console.log(`[notebookStore] 创建笔记本成功: ${notebook.id}`);
      return notebook.id;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        set({ error: '认证失败，请重新登录' });
        throw error;
      }
      
      console.error('[notebookStore] 创建笔记本失败:', error);
      set({ error: error instanceof Error ? error.message : '创建失败' });
      return null;
    }
  },

  // ============================================
  // 更新笔记本（API 同步）
  // ============================================
  updateNotebook: async (id, updates) => {
    const existing = get().notebooks[id];
    if (!existing) return;
    
    // 先更新本地状态（乐观更新）
    const updated: Notebook = { 
      ...existing, 
      ...updates, 
      updatedAt: Date.now() 
    };
    
    set((state) => ({
      notebooks: { ...state.notebooks, [id]: updated }
    }));
    
    try {
      // 调用 API 同步更新
      await notebooksApi.update(id, {
        name: updates.name,
        icon: updates.icon,
      });
      
      // 同步更新根节点的 content（如果名称变更）
      if (updates.name) {
        const nodeStore = useNodeStore.getState();
        nodeStore.updateNode(existing.rootNodeId, { content: updates.name });
      }
      
      console.log(`[notebookStore] 更新笔记本成功: ${id}`);
    } catch (error) {
      // 回滚本地状态
      set((state) => ({
        notebooks: { ...state.notebooks, [id]: existing }
      }));
      
      if (error instanceof AuthenticationError) {
        set({ error: '认证失败，请重新登录' });
        throw error;
      }
      
      console.error('[notebookStore] 更新笔记本失败:', error);
      set({ error: error instanceof Error ? error.message : '更新失败' });
    }
  },

  // ============================================
  // 删除笔记本（API 同步）
  // ============================================
  deleteNotebook: async (id) => {
    const state = get();
    const notebook = state.notebooks[id];
    if (!notebook) return;
    
    // 先删除本地状态（乐观更新）
    const newNotebooks = { ...state.notebooks };
    delete newNotebooks[id];
    const newNotebookIds = state.notebookIds.filter(nid => nid !== id);
    const wasActive = state.activeNotebookId === id;
    
    set({
      notebooks: newNotebooks,
      notebookIds: newNotebookIds,
      activeNotebookId: wasActive ? null : state.activeNotebookId,
      navigationMode: wasActive ? 'calendar' as NavigationMode : state.navigationMode,
    });
    
    // 如果删除的是当前激活的笔记本，跳转到今日
    if (wasActive) {
      const nodeStore = useNodeStore.getState();
      nodeStore.goToToday();
    }
    
    try {
      // 调用 API 删除（API 会级联删除根节点和所有子节点）
      await notebooksApi.delete(id);
      console.log(`[notebookStore] 删除笔记本成功: ${id}`);
    } catch (error) {
      // 回滚本地状态
      set({
        notebooks: state.notebooks,
        notebookIds: state.notebookIds,
        activeNotebookId: state.activeNotebookId,
        navigationMode: state.navigationMode,
      });
      
      if (error instanceof AuthenticationError) {
        set({ error: '认证失败，请重新登录' });
        throw error;
      }
      
      console.error('[notebookStore] 删除笔记本失败:', error);
      set({ error: error instanceof Error ? error.message : '删除失败' });
    }
  },

  // ============================================
  // 导航操作（纯内存状态）
  // ============================================
  setActiveNotebook: (id) => {
    const state = get();
    if (id === null) {
      set({ activeNotebookId: null });
      return;
    }
    
    const notebook = state.notebooks[id];
    if (!notebook) return;
    
    // 切换到笔记本模式，设置 hoisted 到笔记本根节点
    const nodeStore = useNodeStore.getState();
    nodeStore.setHoistedNode(notebook.rootNodeId);
    
    set({
      activeNotebookId: id,
      navigationMode: 'notebook',
    });
  },

  setNavigationMode: (mode) => {
    set({ navigationMode: mode });
  },

  goToCalendar: () => {
    const nodeStore = useNodeStore.getState();
    nodeStore.goToToday();
    
    set({
      activeNotebookId: null,
      navigationMode: 'calendar',
    });
  },

  // ============================================
  // 兼容旧接口（已废弃，自动调用 API）
  // ============================================
  loadFromStorage: () => {
    console.warn('[notebookStore] loadFromStorage 已废弃，请使用 loadFromAPI');
    // 自动调用 API 加载
    get().loadFromAPI().catch((error) => {
      console.error('[notebookStore] loadFromStorage 兼容调用失败:', error);
    });
  },

  saveToStorage: () => {
    console.warn('[notebookStore] saveToStorage 已废弃，数据已自动同步到数据库');
    // 无需操作，数据已通过 API 自动同步
  },

  initWithMockData: () => {
    console.warn('[notebookStore] initWithMockData 已废弃');
    set({ 
      notebooks: {}, 
      notebookIds: [],
      isInitialized: true 
    });
  },
}));

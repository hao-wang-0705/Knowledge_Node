import { create } from 'zustand';
import { Supertag, FieldDefinition } from '@/types';
import { AuthenticationError } from '@/services/api';

// ============================================================================
// Store 类型定义 (v3.4: 移除分类和继承相关功能)
// ============================================================================

interface SupertagStoreState {
  supertags: Record<string, Supertag>;
  recentTags: string[];
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  /** 只读模式标识 - 系统预置标签库不允许用户写操作 */
  isReadOnly: true;
}

interface SupertagStoreActions {
  // API 数据加载（只读）
  loadFromAPI: () => Promise<void>;
  
  // 最近使用标签追踪（仅本地状态，不修改数据库中的标签）
  trackTagUsage: (tagId: string) => void;
  getRecentTags: (limit?: number) => string[];
  clearRecentTags: () => void;
  
  // 工具函数（只读查询）
  getSupertag: (id: string) => Supertag | undefined;
  getAllSupertags: () => Supertag[];
  
  /** 获取字段定义（v3.4: 直接返回标签自身的字段定义，不再处理继承） */
  getFieldDefinitions: (tagId: string) => FieldDefinition[];
}

type SupertagStore = SupertagStoreState & SupertagStoreActions;

// ============================================================================
// Store 实现（只读模式，v3.4: 简化为扁平列表）
// ============================================================================

export const useSupertagStore = create<SupertagStore>((set, get) => ({
  supertags: {},
  recentTags: [],
  isLoading: false,
  isInitialized: false,
  error: null,
  isReadOnly: true,

  // ============================================
  // API 数据加载（只读）
  // ============================================
  loadFromAPI: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch('/api/supertags', {
        credentials: 'include',
      });
      
      // 检查 HTTP 状态
      if (!response.ok) {
        const errorText = await response.text().catch(() => '未知错误');
        console.error(`[supertagStore] API 请求失败: ${response.status} ${errorText}`);
        set({ 
          isLoading: false, 
          error: `API 请求失败: ${response.status}`,
          isInitialized: true,
        });
        return;
      }
      
      // 检查响应体是否为空
      const responseText = await response.text();
      if (!responseText || responseText.trim() === '') {
        console.error('[supertagStore] API 返回空响应');
        set({ 
          isLoading: false, 
          error: 'API 返回空响应',
          isInitialized: true,
        });
        return;
      }
      
      // 解析 JSON
      let supertagsResponse;
      try {
        supertagsResponse = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[supertagStore] JSON 解析失败:', parseError, 'Response:', responseText.slice(0, 200));
        set({ 
          isLoading: false, 
          error: '响应格式错误',
          isInitialized: true,
        });
        return;
      }
    
      if (!supertagsResponse.success) {
        // 检查认证错误
        if (supertagsResponse.error?.includes('未登录') || supertagsResponse.error?.includes('认证')) {
          set({ 
            isLoading: false, 
            error: '认证失败，请重新登录',
            isInitialized: false,
          });
          throw new AuthenticationError(supertagsResponse.error);
        }
        
        set({ 
          isLoading: false, 
          error: supertagsResponse.error || '获取标签失败',
          isInitialized: true,
        });
        return;
      }
      
      // 将标签数组转换为 Record 格式
      const supertagsRecord: Record<string, Supertag> = {};
      (supertagsResponse.data as Supertag[]).forEach(tag => {
        supertagsRecord[tag.id] = tag;
      });
      
      set({ 
        supertags: supertagsRecord,
        isLoading: false, 
        isInitialized: true,
        error: null,
      });
      
      console.log(`[supertagStore] 从 API 加载了 ${Object.keys(supertagsRecord).length} 个系统预置标签（只读模式）`);
    } catch (error) {
      // 捕获 AuthenticationError 需要重新抛出
      if (error instanceof AuthenticationError) {
        throw error;
      }
      
      console.error('[supertagStore] loadFromAPI 错误:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : '网络请求失败',
        isInitialized: true,
      });
    }
  },

  // ============================================
  // 最近使用标签追踪（仅本地状态）
  // ============================================
  trackTagUsage: (tagId) => {
    set((state) => {
      const filtered = state.recentTags.filter(id => id !== tagId);
      const newRecent = [tagId, ...filtered].slice(0, 20);
      // 注意：不再同步到数据库，仅本地状态
      return { recentTags: newRecent };
    });
  },
  
  getRecentTags: (limit = 10) => {
    const { recentTags, supertags } = get();
    return recentTags
      .filter(id => supertags[id])
      .slice(0, limit);
  },
  
  clearRecentTags: () => {
    set({ recentTags: [] });
  },

  // ============================================
  // 工具函数（只读查询）
  // ============================================
  getSupertag: (id) => {
    return get().supertags[id];
  },
  
  getAllSupertags: () => {
    return Object.values(get().supertags).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },

  getFieldDefinitions: (tagId) => {
    const tag = get().supertags[tagId];
    return tag?.fieldDefinitions ?? [];
  },
}));

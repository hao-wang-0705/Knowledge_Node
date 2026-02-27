import { create } from 'zustand';
import { ViewType } from '@/types';
import { debounce } from '@/utils/helpers';
import { FIXED_TAG_IDS } from '@/utils/mockData';
import { SYSTEM_TAGS } from '@/utils/date-helpers';
import { settingsApi, SETTING_KEYS, AuthenticationError } from '@/services/api';

interface PerspectiveStoreState {
  pinnedTagIds: string[];  // 钉住的标签 ID 列表
  activeTagId: string | null;  // 当前激活的透视标签
  previousTagId: string | null;  // 上一个透视标签（用于从聚焦返回）
  isInitialized: boolean;
  error: string | null;  // 错误信息
}

interface PerspectiveStoreActions {
  // 钉住/取消钉住标签
  pinTag: (tagId: string) => void;
  unpinTag: (tagId: string) => void;
  isPinned: (tagId: string) => boolean;
  
  // 设置当前激活的透视
  setActiveTag: (tagId: string | null) => void;
  
  // 获取标签对应的视图类型
  getViewType: (tagId: string) => ViewType;
  
  // 返回上一个透视
  returnToPreviousTag: () => void;
  
  // 清除上一个透视记录（当切换导航模式时调用）
  clearPreviousTag: () => void;
  
  // 从数据库加载数据
  loadFromAPI: () => Promise<void>;
  
  // 初始化默认钉住标签
  initWithDefaults: () => void;
  
  // 清除错误
  clearError: () => void;
}

type PerspectiveStore = PerspectiveStoreState & PerspectiveStoreActions;

// 系统标签列表（不允许被钉住）
const SYSTEM_TAG_IDS: string[] = [
  SYSTEM_TAGS.YEAR,
  SYSTEM_TAGS.MONTH,
  SYSTEM_TAGS.WEEK,
  SYSTEM_TAGS.DAY,
];

// 默认钉住的标签（5个核心标签）
const DEFAULT_PINNED_TAGS = [
  FIXED_TAG_IDS.TASK,      // 待办
  FIXED_TAG_IDS.MEETING,   // 会议
  FIXED_TAG_IDS.PROBLEM,   // 问题
  FIXED_TAG_IDS.IDEA,      // 灵感
  FIXED_TAG_IDS.DOC,       // 文档
];

// 标签到视图类型的映射
const TAG_VIEW_MAP: Record<string, ViewType> = {
  [FIXED_TAG_IDS.TASK]: 'kanban',
  [FIXED_TAG_IDS.MEETING]: 'agenda',
  [FIXED_TAG_IDS.PROBLEM]: 'card',
  [FIXED_TAG_IDS.IDEA]: 'card',
  [FIXED_TAG_IDS.DOC]: 'card',
};

// 防抖保存到数据库
const debouncedSave = debounce(async (pinnedTagIds: string[]) => {
  try {
    await settingsApi.set(SETTING_KEYS.PINNED_TAGS, pinnedTagIds);
  } catch (error) {
    // 认证失败会由中间件处理，这里只记录错误
    if (error instanceof AuthenticationError) {
      console.warn('[perspectiveStore] 认证失败，无法保存钉住标签');
    } else {
      console.error('[perspectiveStore] 保存钉住标签失败:', error);
    }
  }
}, 500);

export const usePerspectiveStore = create<PerspectiveStore>((set, get) => ({
  pinnedTagIds: [],
  activeTagId: null,
  previousTagId: null,
  isInitialized: false,
  error: null,

  loadFromAPI: async () => {
    try {
      const pinnedTagIds = await settingsApi.get<string[]>(SETTING_KEYS.PINNED_TAGS);
      
      if (pinnedTagIds && Array.isArray(pinnedTagIds)) {
        // 过滤掉系统标签
        const validPinnedTags = pinnedTagIds.filter(
          (id: string) => !SYSTEM_TAG_IDS.includes(id)
        );
        
        set({ pinnedTagIds: validPinnedTags, isInitialized: true, error: null });
        console.log(`[perspectiveStore] 从 API 加载了 ${validPinnedTags.length} 个钉住标签`);
      } else {
        // 没有数据，使用默认值
        get().initWithDefaults();
      }
    } catch (error) {
      // 认证错误需要重新抛出，让调用方处理（重定向到登录页）
      if (error instanceof AuthenticationError) {
        set({ error: '认证失败，请重新登录', isInitialized: false });
        throw error;
      }
      
      // 其他错误记录并使用默认值
      console.error('[perspectiveStore] 从 API 加载失败:', error);
      set({ 
        error: error instanceof Error ? error.message : '加载失败',
        isInitialized: true 
      });
      get().initWithDefaults();
    }
  },

  pinTag: (tagId) => {
    // 系统标签不允许钉住
    if (SYSTEM_TAG_IDS.includes(tagId)) {
      console.warn('系统标签不允许被钉住');
      return;
    }
    
    set((state) => {
      if (state.pinnedTagIds.includes(tagId)) return state;
      
      const newPinnedTagIds = [...state.pinnedTagIds, tagId];
      debouncedSave(newPinnedTagIds);
      return { pinnedTagIds: newPinnedTagIds };
    });
  },

  unpinTag: (tagId) => {
    set((state) => {
      const newPinnedTagIds = state.pinnedTagIds.filter(id => id !== tagId);
      debouncedSave(newPinnedTagIds);
      
      // 如果取消钉住的是当前激活的标签，清除激活状态
      const newActiveTagId = state.activeTagId === tagId ? null : state.activeTagId;
      
      return { pinnedTagIds: newPinnedTagIds, activeTagId: newActiveTagId };
    });
  },

  isPinned: (tagId) => {
    return get().pinnedTagIds.includes(tagId);
  },

  setActiveTag: (tagId) => {
    set((state) => {
      // 如果当前有激活的透视且要设置为 null（退出透视），记录为上一个透视
      if (state.activeTagId !== null && tagId === null) {
        return { activeTagId: null, previousTagId: state.activeTagId };
      }
      // 如果设置新的透视，清除上一个记录
      return { activeTagId: tagId, previousTagId: null };
    });
  },

  returnToPreviousTag: () => {
    set((state) => {
      if (state.previousTagId) {
        return { activeTagId: state.previousTagId, previousTagId: null };
      }
      return state;
    });
  },

  clearPreviousTag: () => {
    set({ previousTagId: null });
  },

  getViewType: (tagId) => {
    return TAG_VIEW_MAP[tagId] || 'table';
  },

  initWithDefaults: () => {
    set({ pinnedTagIds: DEFAULT_PINNED_TAGS, isInitialized: true, error: null });
    
    // 异步保存到数据库（不阻塞初始化）
    settingsApi.set(SETTING_KEYS.PINNED_TAGS, DEFAULT_PINNED_TAGS).catch((error) => {
      if (!(error instanceof AuthenticationError)) {
        console.error('[perspectiveStore] 保存默认标签失败:', error);
      }
    });
  },
  
  clearError: () => {
    set({ error: null });
  },
}));

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// 固定标签状态管理 (v3.7)
// 用于管理侧边栏"聚焦"区域的固定标签列表
// ============================================================================

interface PinnedTagsState {
  /** 固定的标签 ID 列表（按固定时间排序，最新在前） */
  pinnedTagIds: string[];
}

interface PinnedTagsActions {
  /** 检查标签是否已固定 */
  isPinned: (tagId: string) => boolean;
  
  /** 固定标签 */
  pinTag: (tagId: string) => void;
  
  /** 取消固定标签 */
  unpinTag: (tagId: string) => void;
  
  /** 切换固定状态 */
  togglePin: (tagId: string) => void;
  
  /** 清空所有固定 */
  clearAllPinned: () => void;
}

type PinnedTagsStore = PinnedTagsState & PinnedTagsActions;

// ============================================================================
// Store 实现（使用 localStorage 持久化）
// ============================================================================

export const usePinnedTagsStore = create<PinnedTagsStore>()(
  persist(
    (set, get) => ({
      pinnedTagIds: [],

      // ============================================
      // 检查标签是否已固定
      // ============================================
      isPinned: (tagId: string) => {
        return get().pinnedTagIds.includes(tagId);
      },

      // ============================================
      // 固定标签
      // ============================================
      pinTag: (tagId: string) => {
        const { pinnedTagIds } = get();
        
        // 避免重复固定
        if (pinnedTagIds.includes(tagId)) {
          return;
        }
        
        // 新固定的标签添加到列表开头
        set({ pinnedTagIds: [tagId, ...pinnedTagIds] });
        
        console.log(`[pinnedTagsStore] 固定标签: ${tagId}`);
      },

      // ============================================
      // 取消固定标签
      // ============================================
      unpinTag: (tagId: string) => {
        const { pinnedTagIds } = get();
        
        set({ 
          pinnedTagIds: pinnedTagIds.filter(id => id !== tagId) 
        });
        
        console.log(`[pinnedTagsStore] 取消固定标签: ${tagId}`);
      },

      // ============================================
      // 切换固定状态
      // ============================================
      togglePin: (tagId: string) => {
        const { isPinned, pinTag, unpinTag } = get();
        
        if (isPinned(tagId)) {
          unpinTag(tagId);
        } else {
          pinTag(tagId);
        }
      },

      // ============================================
      // 清空所有固定
      // ============================================
      clearAllPinned: () => {
        set({ pinnedTagIds: [] });
        console.log('[pinnedTagsStore] 清空所有固定标签');
      },
    }),
    {
      name: 'knowledge-node-pinned-tags', // localStorage key
      partialize: (state) => ({ pinnedTagIds: state.pinnedTagIds }),
    }
  )
);

// ============================================================================
// 选择器 Hooks
// ============================================================================

/** 获取固定标签数量 */
export function usePinnedTagsCount(): number {
  return usePinnedTagsStore((state) => state.pinnedTagIds.length);
}

/** 检查指定标签是否固定（响应式） */
export function useIsTagPinned(tagId: string): boolean {
  return usePinnedTagsStore((state) => state.pinnedTagIds.includes(tagId));
}

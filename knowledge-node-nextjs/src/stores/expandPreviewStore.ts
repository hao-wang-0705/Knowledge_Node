/**
 * 智能扩写幽灵预览状态
 * 按 nodeId 存储未确认的扩写内容，用于幽灵预览与确认/舍弃
 */

import { create } from 'zustand';

export interface ExpandPreviewEntry {
  content: string;
  createdAt: number;
}

interface ExpandPreviewState {
  previews: Record<string, ExpandPreviewEntry>;
}

interface ExpandPreviewActions {
  setPreview: (nodeId: string, content: string | null) => void;
  getPreview: (nodeId: string) => ExpandPreviewEntry | undefined;
  clearPreview: (nodeId: string) => void;
}

export const useExpandPreviewStore = create<ExpandPreviewState & ExpandPreviewActions>((set, get) => ({
  previews: {},

  setPreview: (nodeId, content) => {
    set((state) => {
      if (content === null) {
        const { [nodeId]: _, ...rest } = state.previews;
        return { previews: rest };
      }
      return {
        previews: {
          ...state.previews,
          [nodeId]: { content, createdAt: Date.now() },
        },
      };
    });
  },

  getPreview: (nodeId) => get().previews[nodeId],

  clearPreview: (nodeId) => get().setPreview(nodeId, null),
}));

/**
 * 智能解构幽灵预览状态
 * 按 nodeId 存储未确认的 AI 解构节点树，用于幽灵预览与一键替换
 */

import { create } from 'zustand';
import type { SmartCaptureNode } from '@/types';

export interface DeconstructPreviewEntry {
  nodes: SmartCaptureNode[];
  createdAt: number;
}

interface DeconstructPreviewState {
  previews: Record<string, DeconstructPreviewEntry>;
}

interface DeconstructPreviewActions {
  setPreview: (nodeId: string, nodes: SmartCaptureNode[] | null) => void;
  getPreview: (nodeId: string) => DeconstructPreviewEntry | undefined;
  clearPreview: (nodeId: string) => void;
}

export const useDeconstructPreviewStore = create<DeconstructPreviewState & DeconstructPreviewActions>((set, get) => ({
  previews: {},

  setPreview: (nodeId, nodes) => {
    set((state) => {
      if (nodes === null) {
        const { [nodeId]: _, ...rest } = state.previews;
        return { previews: rest };
      }
      return {
        previews: {
          ...state.previews,
          [nodeId]: { nodes, createdAt: Date.now() },
        },
      };
    });
  },

  getPreview: (nodeId) => get().previews[nodeId],

  clearPreview: (nodeId) => get().setPreview(nodeId, null),
}));

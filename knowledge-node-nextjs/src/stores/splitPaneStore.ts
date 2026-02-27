import { create } from 'zustand';

interface SplitPaneState {
  /** 面板是否打开 */
  isOpen: boolean;
  /** 当前面板显示的节点 ID */
  panelNodeId: string | null;
  /** 面板导航历史栈 */
  panelHistory: string[];
  /** 面板宽度（像素） */
  panelWidth: number;
}

interface SplitPaneActions {
  /** 打开面板并显示指定节点 */
  openPanel: (nodeId: string) => void;
  /** 关闭面板 */
  closePanel: () => void;
  /** 面板内导航（push history） */
  navigateInPanel: (nodeId: string) => void;
  /** 返回上一级（pop history） */
  goBack: () => void;
  /** 清除历史 */
  clearHistory: () => void;
  /** 设置面板宽度 */
  setPanelWidth: (width: number) => void;
}

type SplitPaneStore = SplitPaneState & SplitPaneActions;

const DEFAULT_PANEL_WIDTH = 400;
const MIN_PANEL_WIDTH = 300;
const MAX_PANEL_WIDTH = 600;

export const useSplitPaneStore = create<SplitPaneStore>((set, get) => ({
  // 初始状态
  isOpen: false,
  panelNodeId: null,
  panelHistory: [],
  panelWidth: DEFAULT_PANEL_WIDTH,

  // 打开面板
  openPanel: (nodeId: string) => {
    set({
      isOpen: true,
      panelNodeId: nodeId,
      panelHistory: [nodeId],
    });
  },

  // 关闭面板
  closePanel: () => {
    set({
      isOpen: false,
      panelNodeId: null,
      panelHistory: [],
    });
  },

  // 面板内导航
  navigateInPanel: (nodeId: string) => {
    const { panelHistory } = get();
    // 避免重复添加相同节点
    if (panelHistory[panelHistory.length - 1] === nodeId) return;
    
    set({
      panelNodeId: nodeId,
      panelHistory: [...panelHistory, nodeId],
    });
  },

  // 返回上一级
  goBack: () => {
    const { panelHistory } = get();
    if (panelHistory.length <= 1) {
      // 如果只有一个或没有历史，关闭面板
      set({
        isOpen: false,
        panelNodeId: null,
        panelHistory: [],
      });
      return;
    }
    
    const newHistory = panelHistory.slice(0, -1);
    set({
      panelNodeId: newHistory[newHistory.length - 1],
      panelHistory: newHistory,
    });
  },

  // 清除历史
  clearHistory: () => {
    const { panelNodeId } = get();
    set({
      panelHistory: panelNodeId ? [panelNodeId] : [],
    });
  },

  // 设置面板宽度
  setPanelWidth: (width: number) => {
    const clampedWidth = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, width));
    set({ panelWidth: clampedWidth });
  },
}));

// 导出常量
export { DEFAULT_PANEL_WIDTH, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH };

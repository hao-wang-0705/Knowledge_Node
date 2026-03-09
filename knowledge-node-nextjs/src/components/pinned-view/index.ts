/**
 * pinned-view 模块入口
 * v3.6: 统一导出声明式视图渲染相关组件
 */

// 主容器
export { SupertagPinnedView } from './SupertagPinnedView';

// 注册表
export * from './registry';

// 核心
export * from './core';

// 视图容器
export { DynamicTable } from './containers/DynamicTable';
export { KanbanBoard } from './containers/KanbanBoard';
export { NodeList } from './containers/NodeList';

// 扩展组件
export { AIAggregationBlock } from './widgets/AIAggregationBlock';

// 共享组件
export { PinnedViewHeader } from './shared/PinnedViewHeader';
export { QuickCapture } from './shared/QuickCapture';
export { FocusPanel } from './shared/FocusPanel';
export { ViewSwitcher } from './shared/ViewSwitcher';

/**
 * 标签库组件导出 (v3.3)
 * 
 * v3.3 重构为只读标签图鉴模式：
 * - TagLibraryPage: 主页面（只读图鉴）
 * - TagGalleryGrid: 卡片网格展示组件
 * - TagDetailPanel: 只读详情面板组件
 * 
 * 已移除的可编辑组件：
 * - TagListPanel (已删除)
 * - TagEditorCanvas (已删除)
 * - TagHeaderConfig (已删除)
 * - SchemaFieldList (保留但改为只读展示)
 */

export { default as TagLibraryPage } from './TagLibraryPage';
export { default as TagGalleryGrid } from './TagGalleryGrid';
export { default as TagDetailPanel } from './TagDetailPanel';

// 保留 TemplateContentEditor 用于详情展示（只读）
export { default as TemplateContentEditor } from './TemplateContentEditor';

// ============================================================
// v3.3: 以下组件已废弃，导出仅为向后兼容
// ============================================================

/**
 * @deprecated v3.3: TagListPanel 已移除，请使用 TagGalleryGrid
 */
export { default as TagListPanel } from './TagListPanel';

/**
 * @deprecated v3.3: TagEditorCanvas 已移除，请使用 TagDetailPanel
 */
export { default as TagEditorCanvas } from './TagEditorCanvas';

/**
 * @deprecated v3.3: TagHeaderConfig 已移除
 */
export { default as TagHeaderConfig } from './TagHeaderConfig';

/**
 * @deprecated v3.3: SchemaFieldList 已改为只读展示
 */
export { default as SchemaFieldList } from './SchemaFieldList';

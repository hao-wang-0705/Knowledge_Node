/**
 * 统一视觉样式常量
 * 集中管理全站导航项、侧边栏、卡片、按钮等通用样式
 * 基于 Design Token 系统构建，确保视觉一致性
 */

// ============================================
// 侧边栏导航项样式
// ============================================

export const sidebarItemStyles = {
  /** 所有导航项的基础样式 */
  base: 'group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150',
  
  /** 默认状态（未选中） */
  default: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
  
  /** 激活状态 - 品牌色高亮 */
  active: 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] dark:bg-[var(--brand-primary)]/15',
  
  /** 禁用状态 */
  disabled: 'text-gray-400 dark:text-gray-500 opacity-50 cursor-not-allowed',
  
  /** 图标默认颜色 */
  iconDefault: 'text-gray-400',
  
  /** 图标激活颜色 */
  iconActive: 'text-[var(--brand-primary)]',
} as const;

/** 获取导航项完整类名 */
export function getSidebarItemClass(isActive: boolean, isDisabled?: boolean): string {
  if (isDisabled) {
    return `${sidebarItemStyles.base} ${sidebarItemStyles.disabled}`;
  }
  return `${sidebarItemStyles.base} ${isActive ? sidebarItemStyles.active : sidebarItemStyles.default}`;
}

/** 获取导航项图标类名 */
export function getSidebarIconClass(isActive: boolean): string {
  return isActive ? sidebarItemStyles.iconActive : sidebarItemStyles.iconDefault;
}

// ============================================
// 笔记本列表项样式（带左缩进）
// ============================================

export const notebookItemStyles = {
  /** 基础样式（带左缩进） */
  base: 'group flex items-center gap-2 pl-3 pr-2 py-2 rounded-lg cursor-pointer transition-all',
  
  /** 默认状态 */
  default: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
  
  /** 激活状态 - 统一使用品牌色 */
  active: 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] dark:bg-[var(--brand-primary)]/15',
  
  /** 图标默认颜色 */
  iconDefault: 'text-gray-400',
  
  /** 图标激活颜色 */
  iconActive: 'text-[var(--brand-primary)]',
  
  /** 展开箭头颜色 */
  chevronActive: 'text-[var(--brand-primary)]/60',
  
  /** 今日指示器 */
  todayIndicator: 'w-2 h-2 rounded-full bg-[var(--brand-primary)] animate-pulse flex-shrink-0',
} as const;

/** 获取笔记本项完整类名 */
export function getNotebookItemClass(isActive: boolean): string {
  return `${notebookItemStyles.base} ${isActive ? notebookItemStyles.active : notebookItemStyles.default}`;
}

/** 获取笔记本图标类名 */
export function getNotebookIconClass(isActive: boolean): string {
  return isActive ? notebookItemStyles.iconActive : notebookItemStyles.iconDefault;
}

// ============================================
// Logo 样式
// ============================================

export const logoStyles = {
  /** Logo 容器 */
  container: 'w-8 h-8 rounded-lg flex items-center justify-center shadow-brand',
  
  /** 品牌渐变背景 */
  gradient: 'bg-gradient-brand',
  
  /** Logo 图标 */
  icon: 'text-white',
} as const;

// ============================================
// 用户头像样式
// ============================================

export const avatarStyles = {
  /** 头像容器 */
  container: 'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
  
  /** 品牌渐变背景 */
  gradient: 'bg-gradient-brand',
  
  /** 头像图标 */
  icon: 'text-white',
} as const;

// ============================================
// 搜索框样式
// ============================================

export const searchBoxStyles = {
  /** 搜索框容器 */
  container: [
    'w-full flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg border transition-all duration-150',
    'text-gray-500 dark:text-gray-400',
    'bg-gray-100 dark:bg-gray-800/60',
    'border-gray-200 dark:border-gray-700/50',
    'hover:bg-gray-200/80 dark:hover:bg-gray-700/80',
    'hover:border-gray-300 dark:hover:border-gray-600',
  ].join(' '),
  
  /** 搜索图标 */
  icon: 'text-gray-400',
  
  /** 快捷键样式 */
  shortcut: [
    'hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded border',
    'text-gray-400',
    'bg-white dark:bg-gray-700',
    'border-gray-200 dark:border-gray-600',
  ].join(' '),
} as const;

// ============================================
// 右键菜单样式
// ============================================

export const contextMenuStyles = {
  /** 菜单容器 */
  container: [
    'fixed z-[9999] min-w-[160px] py-1.5 px-1 rounded-xl',
    'bg-white/95 dark:bg-gray-800/95',
    'border border-gray-200 dark:border-gray-700',
    'backdrop-blur-sm',
    'shadow-dropdown',
  ].join(' '),
  
  /** 菜单项 */
  item: [
    'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg mx-0.5',
    'text-gray-700 dark:text-gray-300',
    'hover:bg-gray-100 dark:hover:bg-gray-700',
    'transition-all duration-100',
  ].join(' '),
  
  /** 危险操作菜单项 */
  itemDanger: [
    'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg mx-0.5',
    'text-gray-700 dark:text-gray-300',
    'hover:bg-red-50 hover:text-red-600',
    'dark:hover:bg-red-900/30 dark:hover:text-red-400',
    'transition-all duration-100',
  ].join(' '),
  
  /** 分隔线 */
  divider: 'h-px bg-gray-200 dark:bg-gray-700 my-1.5 mx-2',
  
  /** 菜单项图标容器 */
  iconWrapper: 'flex items-center justify-center w-5 h-5 text-gray-500',
} as const;

// ============================================
// 顶部导航样式
// ============================================

export const topNavStyles = {
  /** 导航栏容器 */
  container: [
    'h-14 flex-shrink-0 z-30',
    'bg-white/80 dark:bg-slate-900/80',
    'backdrop-blur-md',
    'border-b border-gray-200/50 dark:border-gray-800/50',
  ].join(' '),
  
  /** 内部布局 */
  inner: 'h-full px-6 flex items-center justify-between',
  
  /** 品牌区域 */
  brand: 'flex items-center gap-3',
  
  /** 品牌标题 */
  brandTitle: 'text-lg font-semibold text-gray-800 dark:text-gray-100',
  
  /** 操作区域 */
  actions: 'flex items-center gap-2',
  
  /** 分隔线 */
  divider: 'h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1',
} as const;

// ============================================
// 侧边栏容器样式
// ============================================

export const sidebarContainerStyles = {
  /** 侧边栏容器 */
  container: [
    'flex flex-col h-full',
    'bg-slate-50 dark:bg-slate-900',
    'border-r border-gray-200 dark:border-gray-800',
  ].join(' '),
  
  /** 区域分隔线 */
  sectionBorder: 'border-t border-gray-200/60 dark:border-gray-800/60',
} as const;

// ============================================
// 全局背景样式
// ============================================

export const backgroundStyles = {
  /** 主背景渐变 */
  main: 'bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900',
} as const;

// ============================================
// 输入框样式
// ============================================

export const inputStyles = {
  /** 内联编辑输入框 */
  inlineEdit: [
    'flex-1 px-2 py-0.5 text-sm rounded min-w-0',
    'bg-white dark:bg-gray-800',
    'border border-[var(--brand-primary)]/50',
    'outline-none',
    'focus:border-[var(--brand-primary)]',
    'focus:ring-1 focus:ring-[var(--brand-primary)]/30',
  ].join(' '),
} as const;

// ============================================
// 按钮样式变体
// ============================================

export const buttonStyles = {
  /** 幽灵按钮 - 图标 */
  ghostIcon: 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
  
  /** 品牌色高亮按钮 */
  brandHighlight: 'text-[var(--brand-primary)] bg-[var(--brand-primary)]/10 hover:bg-[var(--brand-primary)]/15',
} as const;

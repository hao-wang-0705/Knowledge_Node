/**
 * Core 模块入口
 * v3.6: 统一导出配置解析和组件解析相关功能
 */

export * from './ConfigParser';
export * from './ComponentResolver';
export { DynamicRenderer, type DynamicRendererProps } from './DynamicRenderer';

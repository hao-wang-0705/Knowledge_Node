/**
 * API 客户端统一导出
 * v3.3: Supertag API 重构为只读模式，Categories 模块已移除
 */

export { default as apiClient, ApiError, setUserId, getCurrentUserId } from './client';
export { nodesApi } from './nodes';
export { supertagsApi, tagsApi } from './tags';
export { settingsApi, SETTING_KEYS, AuthenticationError } from './settings';

// 类型导出
export type {
  NodeResponse,
  CreateNodeParams,
  UpdateNodeParams,
  MoveNodeParams,
} from './nodes';

export type {
  SupertagResponse,
} from './tags';

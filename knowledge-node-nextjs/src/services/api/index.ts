/**
 * API 客户端统一导出
 */

export { default as apiClient, ApiError, setUserId, getCurrentUserId } from './client';
export { nodesApi } from './nodes';
export { supertagsApi, tagsApi } from './tags';
export { categoriesApi } from './categories';
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
  CreateSupertagParams,
  UpdateSupertagParams,
} from './tags';

export type {
  CategoryResponse,
  CreateCategoryParams,
  UpdateCategoryParams,
} from './categories';

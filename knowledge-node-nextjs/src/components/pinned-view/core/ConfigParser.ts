/**
 * ConfigParser - ViewConfig 配置解析器
 * v3.6: 负责 ViewConfig JSON 的验证和解析
 */

import type {
  ViewConfig,
  ViewConfigValidationResult,
  ViewConfigValidationError,
  ViewLayoutType,
  WidgetType,
} from '@/types/view-config';

/**
 * 默认 ViewConfig 配置
 */
export const DEFAULT_VIEW_CONFIG: ViewConfig = {
  version: '1.0',
  layout: {
    type: 'table',
    sortField: 'updatedAt',
    sortOrder: 'desc',
  },
};

/**
 * 支持的布局类型
 */
const VALID_LAYOUT_TYPES: ViewLayoutType[] = ['kanban', 'table', 'list'];

/**
 * 支持的组件类型
 */
const VALID_WIDGET_TYPES: WidgetType[] = ['ai-aggregation', 'stats-bar', 'custom'];

/**
 * 验证 ViewConfig 配置
 */
export function validateViewConfig(config: unknown): ViewConfigValidationResult {
  const errors: ViewConfigValidationError[] = [];

  // 检查是否为对象
  if (!config || typeof config !== 'object') {
    return {
      valid: false,
      errors: [{ path: '', message: 'ViewConfig must be an object', type: 'type_mismatch' }],
    };
  }

  const viewConfig = config as Record<string, unknown>;

  // 检查 version
  if (!viewConfig.version) {
    errors.push({ path: 'version', message: 'version is required', type: 'missing' });
  } else if (viewConfig.version !== '1.0') {
    errors.push({ path: 'version', message: 'Unsupported version', type: 'invalid' });
  }

  // 检查 layout
  if (!viewConfig.layout) {
    errors.push({ path: 'layout', message: 'layout is required', type: 'missing' });
  } else if (typeof viewConfig.layout !== 'object') {
    errors.push({ path: 'layout', message: 'layout must be an object', type: 'type_mismatch' });
  } else {
    const layout = viewConfig.layout as Record<string, unknown>;

    // 检查 layout.type
    if (!layout.type) {
      errors.push({ path: 'layout.type', message: 'layout.type is required', type: 'missing' });
    } else if (!VALID_LAYOUT_TYPES.includes(layout.type as ViewLayoutType)) {
      errors.push({
        path: 'layout.type',
        message: `Invalid layout type. Must be one of: ${VALID_LAYOUT_TYPES.join(', ')}`,
        type: 'invalid',
      });
    }

    // kanban 布局必须有 groupByField
    if (layout.type === 'kanban' && !layout.groupByField) {
      errors.push({
        path: 'layout.groupByField',
        message: 'groupByField is required for kanban layout',
        type: 'missing',
      });
    }

    // 检查 sortOrder
    if (layout.sortOrder && !['asc', 'desc'].includes(layout.sortOrder as string)) {
      errors.push({
        path: 'layout.sortOrder',
        message: 'sortOrder must be "asc" or "desc"',
        type: 'invalid',
      });
    }
  }

  // 检查 widgets（可选）
  if (viewConfig.widgets) {
    if (typeof viewConfig.widgets !== 'object') {
      errors.push({ path: 'widgets', message: 'widgets must be an object', type: 'type_mismatch' });
    } else {
      const widgets = viewConfig.widgets as Record<string, unknown>;

      // 验证 header widgets
      if (widgets.header) {
        if (!Array.isArray(widgets.header)) {
          errors.push({
            path: 'widgets.header',
            message: 'widgets.header must be an array',
            type: 'type_mismatch',
          });
        } else {
          errors.push(...validateWidgetConfigs(widgets.header, 'widgets.header'));
        }
      }

      // 验证 sidebar widgets
      if (widgets.sidebar) {
        if (!Array.isArray(widgets.sidebar)) {
          errors.push({
            path: 'widgets.sidebar',
            message: 'widgets.sidebar must be an array',
            type: 'type_mismatch',
          });
        } else {
          errors.push(...validateWidgetConfigs(widgets.sidebar, 'widgets.sidebar'));
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证 Widget 配置数组
 */
function validateWidgetConfigs(
  configs: unknown[],
  basePath: string
): ViewConfigValidationError[] {
  const errors: ViewConfigValidationError[] = [];

  configs.forEach((config, index) => {
    const path = `${basePath}[${index}]`;

    if (!config || typeof config !== 'object') {
      errors.push({ path, message: 'Widget config must be an object', type: 'type_mismatch' });
      return;
    }

    const widgetConfig = config as Record<string, unknown>;

    // 检查 id
    if (!widgetConfig.id || typeof widgetConfig.id !== 'string') {
      errors.push({ path: `${path}.id`, message: 'id is required and must be a string', type: 'missing' });
    }

    // 检查 type
    if (!widgetConfig.type) {
      errors.push({ path: `${path}.type`, message: 'type is required', type: 'missing' });
    } else if (!VALID_WIDGET_TYPES.includes(widgetConfig.type as WidgetType)) {
      errors.push({
        path: `${path}.type`,
        message: `Invalid widget type. Must be one of: ${VALID_WIDGET_TYPES.join(', ')}`,
        type: 'invalid',
      });
    }

    // 检查 props
    if (!widgetConfig.props || typeof widgetConfig.props !== 'object') {
      errors.push({
        path: `${path}.props`,
        message: 'props is required and must be an object',
        type: 'missing',
      });
    }
  });

  return errors;
}

/**
 * 解析并规范化 ViewConfig
 * 将数据库中的 JSON 转换为类型安全的 ViewConfig 对象
 */
export function parseViewConfig(raw: unknown): ViewConfig {
  // 如果为空，返回默认配置
  if (!raw) {
    return DEFAULT_VIEW_CONFIG;
  }

  // 验证配置
  const validation = validateViewConfig(raw);
  if (!validation.valid) {
    console.warn('[ConfigParser] Invalid ViewConfig, using default:', validation.errors);
    return DEFAULT_VIEW_CONFIG;
  }

  // 类型断言并返回
  return raw as ViewConfig;
}

/**
 * 获取有效的布局类型
 * 如果配置的类型无效，返回默认类型
 */
export function getValidLayoutType(type: unknown): ViewLayoutType {
  if (typeof type === 'string' && VALID_LAYOUT_TYPES.includes(type as ViewLayoutType)) {
    return type as ViewLayoutType;
  }
  return 'table';
}

/**
 * 合并 ViewConfig（深度合并）
 */
export function mergeViewConfig(
  base: ViewConfig,
  overrides: Partial<ViewConfig>
): ViewConfig {
  return {
    ...base,
    ...overrides,
    layout: {
      ...base.layout,
      ...(overrides.layout || {}),
    },
    widgets: overrides.widgets !== undefined ? overrides.widgets : base.widgets,
    actions: overrides.actions !== undefined
      ? {
          ...base.actions,
          ...overrides.actions,
        }
      : base.actions,
  };
}

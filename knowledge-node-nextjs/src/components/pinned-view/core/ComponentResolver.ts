/**
 * ComponentResolver - 组件解析器
 * v3.6: 根据 ViewConfig 解析并实例化对应的视图容器和扩展组件
 */

import type { ComponentType } from 'react';
import type {
  ViewConfig,
  ViewLayoutType,
  WidgetConfig,
  WidgetType,
} from '@/types/view-config';
import type { TagTemplate, Node } from '@/types';
import {
  ViewRegistry,
  DEFAULT_VIEW_TYPE,
  type ViewContainerProps,
  type ViewContainerComponent,
} from '../registry/ViewRegistry';
import {
  WidgetRegistry,
  type WidgetBaseProps,
  type WidgetComponent,
} from '../registry/WidgetRegistry';

/**
 * 解析后的视图配置
 */
export interface ResolvedViewConfig {
  /** 视图容器组件 */
  ViewContainer: ViewContainerComponent | null;
  /** 布局类型 */
  layoutType: ViewLayoutType;
  /** 头部组件列表 */
  headerWidgets: ResolvedWidget[];
  /** 侧边栏组件列表 */
  sidebarWidgets: ResolvedWidget[];
  /** 是否有有效的视图配置 */
  hasValidConfig: boolean;
}

/**
 * 解析后的 Widget
 */
export interface ResolvedWidget {
  /** 组件 ID */
  id: string;
  /** 组件类型 */
  type: WidgetType;
  /** 组件 */
  Component: WidgetComponent | null;
  /** 组件配置 */
  config: WidgetConfig;
}

/**
 * 组件解析器类
 */
export class ComponentResolver {
  /**
   * 解析 ViewConfig 配置
   */
  static resolve(
    viewConfig: ViewConfig | null | undefined,
    tagTemplate: TagTemplate,
    nodes: Node[]
  ): ResolvedViewConfig {
    // 如果没有配置，使用默认值
    if (!viewConfig) {
      return this.createDefaultResolved();
    }

    const layoutType = viewConfig.layout.type;
    const ViewContainer = ViewRegistry.getComponent(layoutType);

    // 解析 widgets
    const headerWidgets = this.resolveWidgets(viewConfig.widgets?.header || []);
    const sidebarWidgets = this.resolveWidgets(viewConfig.widgets?.sidebar || []);

    return {
      ViewContainer: ViewContainer || null,
      layoutType,
      headerWidgets,
      sidebarWidgets,
      hasValidConfig: true,
    };
  }

  /**
   * 创建默认的解析结果
   */
  private static createDefaultResolved(): ResolvedViewConfig {
    const ViewContainer = ViewRegistry.getComponent(DEFAULT_VIEW_TYPE);
    return {
      ViewContainer: ViewContainer || null,
      layoutType: DEFAULT_VIEW_TYPE,
      headerWidgets: [],
      sidebarWidgets: [],
      hasValidConfig: false,
    };
  }

  /**
   * 解析 Widget 配置数组
   */
  private static resolveWidgets(configs: WidgetConfig[]): ResolvedWidget[] {
    return configs.map((config) => ({
      id: config.id,
      type: config.type,
      Component: WidgetRegistry.getComponent(config.type) || null,
      config,
    }));
  }

  /**
   * 检查视图类型是否可用
   */
  static isViewTypeAvailable(type: ViewLayoutType): boolean {
    return ViewRegistry.has(type);
  }

  /**
   * 检查组件类型是否可用
   */
  static isWidgetTypeAvailable(type: WidgetType): boolean {
    return WidgetRegistry.has(type);
  }

  /**
   * 获取所有可用的视图类型
   */
  static getAvailableViewTypes(): ViewLayoutType[] {
    return ViewRegistry.getTypes();
  }

  /**
   * 获取适合指定位置的组件类型
   */
  static getWidgetTypesForPosition(position: 'header' | 'sidebar'): WidgetType[] {
    return WidgetRegistry.getByPosition(position).map((entry) => entry.type);
  }
}

/**
 * 快捷解析函数
 */
export function resolveViewConfig(
  viewConfig: ViewConfig | null | undefined,
  tagTemplate: TagTemplate,
  nodes: Node[]
): ResolvedViewConfig {
  return ComponentResolver.resolve(viewConfig, tagTemplate, nodes);
}

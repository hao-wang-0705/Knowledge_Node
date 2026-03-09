/**
 * ViewRegistry - 视图容器注册表
 * v3.6: 实现可扩展的视图容器动态注册与解析
 */

import type { ComponentType } from 'react';
import type { ViewLayoutType, ViewLayoutConfig } from '@/types/view-config';
import type { TagTemplate, Node } from '@/types';

/**
 * 视图容器组件 Props 基础接口
 */
export interface ViewContainerProps {
  /** 当前标签模板 */
  tagTemplate: TagTemplate;
  /** 节点列表 */
  nodes: Node[];
  /** 布局配置 */
  layoutConfig: ViewLayoutConfig;
  /** 选中节点 ID */
  selectedNodeId?: string | null;
  /** 节点选中回调 */
  onNodeSelect?: (nodeId: string) => void;
  /** 节点更新回调 */
  onNodeUpdate?: (nodeId: string, updates: Partial<Node>) => void;
  /** 节点删除回调 */
  onNodeDelete?: (nodeId: string) => void;
  /** 是否加载中 */
  isLoading?: boolean;
}

/**
 * 视图容器组件类型
 */
export type ViewContainerComponent = ComponentType<ViewContainerProps>;

/**
 * 视图注册项
 */
export interface ViewRegistryEntry {
  /** 视图类型 */
  type: ViewLayoutType;
  /** 视图组件 */
  component: ViewContainerComponent;
  /** 显示名称 */
  displayName: string;
  /** 图标 */
  icon?: string;
  /** 描述 */
  description?: string;
  /** 是否需要分组字段 */
  requiresGroupField?: boolean;
}

/**
 * 视图容器注册表（单例模式）
 */
class ViewRegistryClass {
  private static instance: ViewRegistryClass;
  private registry: Map<ViewLayoutType, ViewRegistryEntry> = new Map();

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): ViewRegistryClass {
    if (!ViewRegistryClass.instance) {
      ViewRegistryClass.instance = new ViewRegistryClass();
    }
    return ViewRegistryClass.instance;
  }

  /**
   * 注册视图容器组件
   */
  register(entry: ViewRegistryEntry): void {
    if (this.registry.has(entry.type)) {
      console.warn(`[ViewRegistry] Overwriting existing view: ${entry.type}`);
    }
    this.registry.set(entry.type, entry);
  }

  /**
   * 注销视图容器组件
   */
  unregister(type: ViewLayoutType): boolean {
    return this.registry.delete(type);
  }

  /**
   * 获取视图容器组件
   */
  get(type: ViewLayoutType): ViewRegistryEntry | undefined {
    return this.registry.get(type);
  }

  /**
   * 获取视图容器组件（类型安全）
   */
  getComponent(type: ViewLayoutType): ViewContainerComponent | undefined {
    return this.registry.get(type)?.component;
  }

  /**
   * 检查视图类型是否已注册
   */
  has(type: ViewLayoutType): boolean {
    return this.registry.has(type);
  }

  /**
   * 获取所有已注册的视图类型
   */
  getAll(): ViewRegistryEntry[] {
    return Array.from(this.registry.values());
  }

  /**
   * 获取所有已注册的视图类型名称
   */
  getTypes(): ViewLayoutType[] {
    return Array.from(this.registry.keys());
  }

  /**
   * 清空注册表（主要用于测试）
   */
  clear(): void {
    this.registry.clear();
  }
}

/**
 * 视图注册表单例
 */
export const ViewRegistry = ViewRegistryClass.getInstance();

/**
 * 注册视图容器组件的便捷函数
 */
export function registerView(entry: ViewRegistryEntry): void {
  ViewRegistry.register(entry);
}

/**
 * 默认视图类型（未配置时的回退）
 */
export const DEFAULT_VIEW_TYPE: ViewLayoutType = 'table';

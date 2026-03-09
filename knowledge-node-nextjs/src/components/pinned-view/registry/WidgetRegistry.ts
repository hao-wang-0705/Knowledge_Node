/**
 * WidgetRegistry - 扩展组件注册表
 * v3.6: 实现可扩展的 Widget 组件动态注册与解析
 */

import type { ComponentType } from 'react';
import type { WidgetType, WidgetConfig } from '@/types/view-config';
import type { TagTemplate, Node } from '@/types';

/**
 * Widget 组件 Props 基础接口
 */
export interface WidgetBaseProps {
  /** 组件配置 */
  config: WidgetConfig;
  /** 当前标签模板 */
  tagTemplate: TagTemplate;
  /** 节点列表 */
  nodes: Node[];
  /** 自定义样式类名 */
  className?: string;
}

/**
 * Widget 组件类型
 */
export type WidgetComponent = ComponentType<WidgetBaseProps>;

/**
 * Widget 注册项
 */
export interface WidgetRegistryEntry {
  /** 组件类型 */
  type: WidgetType;
  /** 组件 */
  component: WidgetComponent;
  /** 显示名称 */
  displayName: string;
  /** 图标 */
  icon?: string;
  /** 描述 */
  description?: string;
  /** 允许的挂载位置 */
  allowedPositions?: ('header' | 'sidebar')[];
  /** 是否可以有多个实例 */
  allowMultiple?: boolean;
}

/**
 * 扩展组件注册表（单例模式）
 */
class WidgetRegistryClass {
  private static instance: WidgetRegistryClass;
  private registry: Map<WidgetType, WidgetRegistryEntry> = new Map();

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): WidgetRegistryClass {
    if (!WidgetRegistryClass.instance) {
      WidgetRegistryClass.instance = new WidgetRegistryClass();
    }
    return WidgetRegistryClass.instance;
  }

  /**
   * 注册扩展组件
   */
  register(entry: WidgetRegistryEntry): void {
    if (this.registry.has(entry.type)) {
      console.warn(`[WidgetRegistry] Overwriting existing widget: ${entry.type}`);
    }
    this.registry.set(entry.type, entry);
  }

  /**
   * 注销扩展组件
   */
  unregister(type: WidgetType): boolean {
    return this.registry.delete(type);
  }

  /**
   * 获取扩展组件注册项
   */
  get(type: WidgetType): WidgetRegistryEntry | undefined {
    return this.registry.get(type);
  }

  /**
   * 获取扩展组件
   */
  getComponent(type: WidgetType): WidgetComponent | undefined {
    return this.registry.get(type)?.component;
  }

  /**
   * 检查组件类型是否已注册
   */
  has(type: WidgetType): boolean {
    return this.registry.has(type);
  }

  /**
   * 获取所有已注册的组件
   */
  getAll(): WidgetRegistryEntry[] {
    return Array.from(this.registry.values());
  }

  /**
   * 获取指定位置允许的组件
   */
  getByPosition(position: 'header' | 'sidebar'): WidgetRegistryEntry[] {
    return this.getAll().filter(
      (entry) => !entry.allowedPositions || entry.allowedPositions.includes(position)
    );
  }

  /**
   * 清空注册表（主要用于测试）
   */
  clear(): void {
    this.registry.clear();
  }
}

/**
 * 扩展组件注册表单例
 */
export const WidgetRegistry = WidgetRegistryClass.getInstance();

/**
 * 注册扩展组件的便捷函数
 */
export function registerWidget(entry: WidgetRegistryEntry): void {
  WidgetRegistry.register(entry);
}

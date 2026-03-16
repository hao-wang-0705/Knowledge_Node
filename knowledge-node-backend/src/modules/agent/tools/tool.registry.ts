/**
 * 工具注册中心
 * 管理所有AI工具的注册、发现和获取
 */

import { AITool, ToolCategory, ToolRegistration } from '../interfaces';

export class ToolRegistry {
  private tools: Map<string, ToolRegistration> = new Map();
  private categoryIndex: Map<ToolCategory, string[]> = new Map();

  /**
   * 注册工具
   */
  register(tool: AITool, priority: number = 0, enabled: boolean = true): void {
    const registration: ToolRegistration = { tool, priority, enabled };
    this.tools.set(tool.name, registration);

    // 更新分类索引
    const category = tool.category;
    if (!this.categoryIndex.has(category)) {
      this.categoryIndex.set(category, []);
    }
    const categoryTools = this.categoryIndex.get(category)!;
    if (!categoryTools.includes(tool.name)) {
      categoryTools.push(tool.name);
    }
  }

  /**
   * 注销工具
   */
  unregister(name: string): boolean {
    const registration = this.tools.get(name);
    if (!registration) return false;

    // 从分类索引移除
    const category = registration.tool.category;
    const categoryTools = this.categoryIndex.get(category);
    if (categoryTools) {
      const index = categoryTools.indexOf(name);
      if (index > -1) {
        categoryTools.splice(index, 1);
      }
    }

    return this.tools.delete(name);
  }

  /**
   * 获取工具
   */
  get(name: string): AITool | undefined {
    const registration = this.tools.get(name);
    return registration?.enabled ? registration.tool : undefined;
  }

  /**
   * 根据分类获取工具列表
   */
  getByCategory(category: ToolCategory): AITool[] {
    const names = this.categoryIndex.get(category) || [];
    return names
      .map(name => this.tools.get(name))
      .filter((reg): reg is ToolRegistration => reg !== undefined && reg.enabled)
      .sort((a, b) => b.priority - a.priority)
      .map(reg => reg.tool);
  }

  /**
   * 获取所有已启用的工具
   */
  getAllEnabled(): AITool[] {
    return Array.from(this.tools.values())
      .filter(reg => reg.enabled)
      .sort((a, b) => b.priority - a.priority)
      .map(reg => reg.tool);
  }

  /**
   * 获取所有工具信息（用于意图识别）
   */
  getToolDescriptions(): Array<{ name: string; description: string; category: ToolCategory }> {
    return this.getAllEnabled().map(tool => ({
      name: tool.name,
      description: tool.description,
      category: tool.category,
    }));
  }

  /**
   * 启用/禁用工具
   */
  setEnabled(name: string, enabled: boolean): boolean {
    const registration = this.tools.get(name);
    if (!registration) return false;
    registration.enabled = enabled;
    return true;
  }

  /**
   * 检查工具是否存在且启用
   */
  has(name: string): boolean {
    const registration = this.tools.get(name);
    return registration !== undefined && registration.enabled;
  }

  /**
   * 获取已注册工具数量
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * 获取已启用工具数量
   */
  get enabledCount(): number {
    return Array.from(this.tools.values()).filter(reg => reg.enabled).length;
  }
}

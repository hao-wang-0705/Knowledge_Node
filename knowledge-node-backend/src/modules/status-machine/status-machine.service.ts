import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { StatusConfig, StatusFieldInfo } from './status-config.types';

@Injectable()
export class StatusMachineService {
  private cache = new Map<string, StatusFieldInfo | null>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 按标签名称获取状态字段的 key 与 statusConfig（从 TagTemplate.fieldDefinitions 中 type===status 的项）
   */
  async getStatusConfig(tagName: string): Promise<StatusFieldInfo | null> {
    const cached = this.cache.get(tagName);
    if (cached !== undefined) return cached;

    const tag = await this.prisma.tagTemplate.findFirst({
      where: { name: tagName, status: 'active' },
      select: { fieldDefinitions: true },
    });
    if (!tag) {
      this.cache.set(tagName, null);
      return null;
    }

    const defs = (tag.fieldDefinitions as Array<{ type?: string; key?: string; statusConfig?: StatusConfig }>) ?? [];
    const statusField = defs.find((d) => d.type === 'status');
    if (!statusField?.key || !statusField.statusConfig) {
      this.cache.set(tagName, null);
      return null;
    }

    const info: StatusFieldInfo = {
      fieldKey: statusField.key,
      config: statusField.statusConfig as StatusConfig,
    };
    this.cache.set(tagName, info);
    return info;
  }

  /** 当前状态是否属于“阻塞态”（如 todo 的 Locked） */
  async isBlocked(tagName: string, statusValue: string): Promise<boolean> {
    const info = await this.getStatusConfig(tagName);
    if (!info?.config.blockedStates) return false;
    return info.config.blockedStates.includes(statusValue);
  }

  /** 当前状态是否属于“已解决/已解除”（如卡点的 Resolved），用于 BLOCKS 前置是否可视为解除 */
  async isResolved(tagName: string, statusValue: string): Promise<boolean> {
    const info = await this.getStatusConfig(tagName);
    if (!info?.config.resolvedState) return false;
    return info.config.resolvedState === statusValue;
  }

  /** 当前状态是否为“完成态”（如 todo 的 Done），用于判断前置 todo 是否已做完 */
  async isDone(tagName: string, statusValue: string): Promise<boolean> {
    const info = await this.getStatusConfig(tagName);
    if (!info?.config.doneState) return false;
    return info.config.doneState === statusValue;
  }

  /**
   * 根据事件取下一状态；若配置中无该事件或当前状态无映射则返回 null
   */
  async getNextStatus(
    tagName: string,
    _fieldKey: string,
    currentStatus: string,
    event: string,
  ): Promise<string | null> {
    const info = await this.getStatusConfig(tagName);
    const map = info?.config.transitions?.[event];
    if (!map) return null;
    return map[currentStatus] ?? null;
  }

  /**
   * 获取标签的状态字段 key（如 todo -> todo_status, 卡点 -> blocker_status）
   */
  async getStatusFieldKey(tagName: string): Promise<string | null> {
    const info = await this.getStatusConfig(tagName);
    return info?.fieldKey ?? null;
  }

  /**
   * 获取“未阻塞时应设成的状态”（如 todo 的 unblockedStates[0] -> Ready）
   */
  async getUnblockedState(tagName: string): Promise<string | null> {
    const info = await this.getStatusConfig(tagName);
    const states = info?.config.unblockedStates;
    return states?.length ? states[0] ?? null : null;
  }

  /**
   * 获取“存在未解除前置时应设成的状态”（如 todo 的 blockedStates[0] -> Locked）
   */
  async getBlockedState(tagName: string): Promise<string | null> {
    const info = await this.getStatusConfig(tagName);
    const states = info?.config.blockedStates;
    return states?.length ? states[0] ?? null : null;
  }

  /** 清除缓存（如批量导入标签后可调用） */
  clearCache(): void {
    this.cache.clear();
  }
}

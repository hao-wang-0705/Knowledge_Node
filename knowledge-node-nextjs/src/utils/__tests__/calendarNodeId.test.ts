import { describe, it, expect, beforeEach } from 'vitest';
import {
  findCalendarNodeActualId,
  resolveCalendarParentId,
  initCalendarNodeIdMap,
  setCalendarNodeIdMapping,
} from '@/utils/calendarNodeId';
import type { Node } from '@/types';

const mkNode = (id: string, parentId: string | null): Node =>
  ({
    id,
    content: '',
    parentId,
    childrenIds: [],
    isCollapsed: false,
    tags: [],
    fields: {},
    createdAt: Date.now(),
  }) as Node;

describe('calendarNodeId', () => {
  beforeEach(() => {
    initCalendarNodeIdMap({});
  });

  describe('findCalendarNodeActualId', () => {
    it('无前缀：原始 ID 存在时返回自身', () => {
      const nodes: Record<string, Node> = {
        'day-2026-02-27': mkNode('day-2026-02-27', null),
      };
      initCalendarNodeIdMap(nodes);
      expect(findCalendarNodeActualId('day-2026-02-27', nodes)).toBe('day-2026-02-27');
    });

    it('带前缀：仅存在带前缀节点时返回带前缀 ID', () => {
      const nodes: Record<string, Node> = {
        'user1_day-2026-02-27': mkNode('user1_day-2026-02-27', null),
      };
      initCalendarNodeIdMap(nodes);
      expect(findCalendarNodeActualId('day-2026-02-27', nodes)).toBe('user1_day-2026-02-27');
    });

    it('多用户前缀：映射后再次查找命中缓存', () => {
      const nodes: Record<string, Node> = {
        'abc_month-2026-02': mkNode('abc_month-2026-02', null),
      };
      initCalendarNodeIdMap(nodes);
      expect(findCalendarNodeActualId('month-2026-02', nodes)).toBe('abc_month-2026-02');
      expect(findCalendarNodeActualId('month-2026-02', nodes)).toBe('abc_month-2026-02');
    });

    it('不存在时返回 null', () => {
      const nodes: Record<string, Node> = {};
      expect(findCalendarNodeActualId('day-2026-02-27', nodes)).toBeNull();
    });

    it('setCalendarNodeIdMapping 后可直接命中', () => {
      const nodes: Record<string, Node> = {
        'custom_day_123': mkNode('custom_day_123', null),
      };
      setCalendarNodeIdMapping('day-2026-02-27', 'custom_day_123');
      expect(findCalendarNodeActualId('day-2026-02-27', nodes)).toBe('custom_day_123');
    });
  });

  describe('resolveCalendarParentId', () => {
    it('null 输入返回 undefined（表示未知父节点）', () => {
      expect(resolveCalendarParentId(null, {})).toBeUndefined();
    });

    it('undefined 输入返回 undefined（表示未知父节点）', () => {
      expect(resolveCalendarParentId(undefined, {})).toBeUndefined();
    });

    it('非日历 ID 直接返回原 ID', () => {
      const nodes = { 'node-1': mkNode('node-1', null) };
      expect(resolveCalendarParentId('node-1', nodes)).toBe('node-1');
    });

    it('日历 ID 存在时返回实际 ID', () => {
      const nodes: Record<string, Node> = {
        'user1_day-2026-02-27': mkNode('user1_day-2026-02-27', null),
      };
      initCalendarNodeIdMap(nodes);
      expect(resolveCalendarParentId('day-2026-02-27', nodes)).toBe('user1_day-2026-02-27');
    });
  });

  describe('initCalendarNodeIdMap', () => {
    it('无前缀日历节点建立自映射', () => {
      const nodes: Record<string, Node> = {
        'year-2026': mkNode('year-2026', null),
        'day-2026-02-27': mkNode('day-2026-02-27', null),
      };
      initCalendarNodeIdMap(nodes);
      expect(findCalendarNodeActualId('year-2026', nodes)).toBe('year-2026');
      expect(findCalendarNodeActualId('day-2026-02-27', nodes)).toBe('day-2026-02-27');
    });

    it('带前缀日历节点建立 originalId -> prefixedId 映射', () => {
      const nodes: Record<string, Node> = {
        'uid_month-2026-02': mkNode('uid_month-2026-02', null),
      };
      initCalendarNodeIdMap(nodes);
      expect(findCalendarNodeActualId('month-2026-02', nodes)).toBe('uid_month-2026-02');
    });
  });
});

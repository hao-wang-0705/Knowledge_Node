import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSupertagStore } from '@/stores/supertagStore';
import type { Supertag } from '@/types';

vi.mock('@/services/api', () => ({
  settingsApi: {
    get: vi.fn(async () => []),
    set: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
  },
  SETTING_KEYS: {
    RECENT_TAGS: 'recentTags',
  },
  AuthenticationError: class AuthenticationError extends Error {},
}));

const createTag = (overrides: Partial<Supertag>): Supertag => ({
  id: 'tag-default',
  name: '默认标签',
  color: '#6366F1',
  fieldDefinitions: [],
  ...overrides,
});

describe('supertagStore (v3.4 只读模式)', () => {
  beforeEach(() => {
    useSupertagStore.setState({
      supertags: {},
      recentTags: [],
      error: null,
      isInitialized: true,
      isLoading: false,
    });
  });

  it('getSupertag 可以获取单个标签', () => {
    useSupertagStore.setState({
      supertags: {
        a: createTag({ id: 'a', name: 'A' }),
        b: createTag({ id: 'b', name: 'B' }),
      },
    });

    const tag = useSupertagStore.getState().getSupertag('a');
    expect(tag?.name).toBe('A');
    expect(useSupertagStore.getState().getSupertag('x')).toBeUndefined();
  });

  it('getAllSupertags 返回所有标签列表', () => {
    useSupertagStore.setState({
      supertags: {
        a: createTag({ id: 'a', name: 'A' }),
        b: createTag({ id: 'b', name: 'B' }),
      },
    });

    const tags = useSupertagStore.getState().getAllSupertags();
    expect(tags).toHaveLength(2);
    expect(tags.map((t) => t.id)).toEqual(expect.arrayContaining(['a', 'b']));
  });

  it('trackTagUsage 可以追踪最近使用的标签', () => {
    useSupertagStore.setState({
      supertags: {
        a: createTag({ id: 'a', name: 'A' }),
        b: createTag({ id: 'b', name: 'B' }),
      },
    });

    useSupertagStore.getState().trackTagUsage('a');
    useSupertagStore.getState().trackTagUsage('b');
    useSupertagStore.getState().trackTagUsage('a'); // 重复使用

    const recent = useSupertagStore.getState().getRecentTags(10);
    expect(recent[0]).toBe('a'); // 最近使用的在前
    expect(recent[1]).toBe('b');
  });

  it('getFieldDefinitions 返回标签的字段定义', () => {
    useSupertagStore.setState({
      supertags: {
        tag1: createTag({
          id: 'tag1',
          name: 'Tag1',
          fieldDefinitions: [
            { id: 'f1', key: 'status', name: '状态', type: 'select', options: ['A', 'B'] },
            { id: 'f2', key: 'due', name: '截止日期', type: 'date' },
          ],
        }),
      },
    });

    const defs = useSupertagStore.getState().getFieldDefinitions('tag1');
    expect(defs).toHaveLength(2);
    expect(defs[0].key).toBe('status');
    expect(defs[1].key).toBe('due');
  });

  it('getFieldDefinitions 对不存在的标签返回空数组', () => {
    const defs = useSupertagStore.getState().getFieldDefinitions('non-existent');
    expect(defs).toEqual([]);
  });

  it('isReadOnly 始终为 true', () => {
    expect(useSupertagStore.getState().isReadOnly).toBe(true);
  });
});

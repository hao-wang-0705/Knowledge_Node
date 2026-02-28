import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSupertagStore } from '@/stores/supertagStore';
import { PRESET_CATEGORY_IDS, type Supertag } from '@/types';

vi.mock('@/services/api', () => ({
  categoriesApi: {
    getAll: vi.fn(async () => []),
    create: vi.fn(async () => ({})),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
    batchUpdate: vi.fn(async () => ({})),
  },
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
  categoryId: PRESET_CATEGORY_IDS.UNCATEGORIZED,
  ...overrides,
});

describe('supertagStore', () => {
  beforeEach(() => {
    useSupertagStore.setState({
      supertags: {},
      recentTags: [],
      error: null,
      isInitialized: true,
      isLoading: false,
    });
  });

  it('可以返回标签后代 ID（包含自身）', () => {
    useSupertagStore.setState({
      supertags: {
        a: createTag({ id: 'a', name: 'A' }),
        b: createTag({ id: 'b', name: 'B', parentId: 'a' }),
        c: createTag({ id: 'c', name: 'C', parentId: 'b' }),
        d: createTag({ id: 'd', name: 'D' }),
      },
    });

    const ids = useSupertagStore.getState().getDescendantIds('a');
    expect(ids).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    expect(ids).not.toContain('d');
  });

  it('字段继承时子标签可覆盖父标签同 key 字段', () => {
    useSupertagStore.setState({
      supertags: {
        parent: createTag({
          id: 'parent',
          name: 'Parent',
          fieldDefinitions: [
            { id: 'f1', key: 'priority', name: '优先级', type: 'text' },
            { id: 'f2', key: 'owner', name: '负责人', type: 'text' },
          ],
        }),
        child: createTag({
          id: 'child',
          name: 'Child',
          parentId: 'parent',
          fieldDefinitions: [{ id: 'f3', key: 'priority', name: '子优先级', type: 'select' }],
        }),
      },
    });

    const defs = useSupertagStore.getState().getResolvedFieldDefinitions('child');
    const priority = defs.find((f) => f.key === 'priority');
    const owner = defs.find((f) => f.key === 'owner');

    expect(priority?.name).toBe('子优先级');
    expect(priority?.inherited).toBe(false);
    expect(owner?.inherited).toBe(true);
  });

  it('存在循环继承时不会无限递归（Edge Case）', () => {
    useSupertagStore.setState({
      supertags: {
        a: createTag({
          id: 'a',
          name: 'A',
          parentId: 'b',
          fieldDefinitions: [{ id: 'fa', key: 'a', name: 'A', type: 'text' }],
        }),
        b: createTag({
          id: 'b',
          name: 'B',
          parentId: 'a',
          fieldDefinitions: [{ id: 'fb', key: 'b', name: 'B', type: 'text' }],
        }),
      },
    });

    const defs = useSupertagStore.getState().getResolvedFieldDefinitions('a');
    expect(defs.length).toBeGreaterThan(0);
  });

  it('fieldDefinitions 更新后 getResolvedFieldDefinitions 返回新字段列表', () => {
    useSupertagStore.setState({
      supertags: {
        tag1: createTag({
          id: 'tag1',
          name: 'Tag1',
          fieldDefinitions: [
            { id: 'f1', key: 'old', name: '旧字段', type: 'text' },
          ],
        }),
      },
    });

    let defs = useSupertagStore.getState().getResolvedFieldDefinitions('tag1');
    expect(defs).toHaveLength(1);
    expect(defs[0].key).toBe('old');

    useSupertagStore.setState({
      supertags: {
        tag1: createTag({
          id: 'tag1',
          name: 'Tag1',
          fieldDefinitions: [
            { id: 'f1', key: 'old', name: '旧字段', type: 'text' },
            { id: 'f2', key: 'new', name: '新字段', type: 'number' },
          ],
        }),
      },
    });

    defs = useSupertagStore.getState().getResolvedFieldDefinitions('tag1');
    expect(defs).toHaveLength(2);
    expect(defs.map((d) => d.key)).toEqual(expect.arrayContaining(['old', 'new']));
    expect(defs.find((d) => d.key === 'new')?.type).toBe('number');
  });

  it('优先使用 API 返回的 resolvedFieldDefinitions（Edge Case）', () => {
    useSupertagStore.setState({
      supertags: {
        apiTag: createTag({
          id: 'apiTag',
          name: 'API 标签',
          fieldDefinitions: [{ id: 'f1', key: 'local', name: '本地', type: 'text' }],
          resolvedFieldDefinitions: [
            { id: 'f2', key: 'resolved', name: '合并后', type: 'text' as const },
          ],
        }),
      },
    });

    const defs = useSupertagStore.getState().getResolvedFieldDefinitions('apiTag');
    expect(defs).toHaveLength(1);
    expect(defs[0].key).toBe('resolved');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNodeStore } from '@/stores/nodeStore';

vi.mock('@/stores/syncStore', () => ({
  useSyncStore: {
    getState: () => ({
      queueOperation: vi.fn(),
      initialize: vi.fn(),
      isInitialized: true,
      isOnline: false,
      setStatus: vi.fn(),
      setError: vi.fn(),
    }),
  },
}));

describe('nodeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useNodeStore.setState({
      nodes: {},
      rootIds: [],
      focusedNodeId: null,
      hoistedNodeId: null,
    });
  });

  it('可以创建根节点和子节点（Happy Path）', () => {
    const store = useNodeStore.getState();
    const rootId = store.addNode(null);
    const childId = store.addNode(rootId);

    const state = useNodeStore.getState();
    expect(state.rootIds).toContain(rootId);
    expect(state.nodes[childId].parentId).toBe(rootId);
    expect(state.nodes[rootId].childrenIds).toContain(childId);
  });

  it('支持 Tab 缩进和 Shift+Tab 反缩进', () => {
    const store = useNodeStore.getState();
    const firstId = store.addNode(null);
    const secondId = store.addNode(null);

    store.indentNode(secondId);
    let state = useNodeStore.getState();
    expect(state.nodes[secondId].parentId).toBe(firstId);
    expect(state.rootIds).toEqual([firstId]);

    store.outdentNode(secondId);
    state = useNodeStore.getState();
    expect(state.nodes[secondId].parentId).toBeNull();
    expect(state.rootIds).toEqual([firstId, secondId]);
  });

  it('多层缩进后 childrenIds 顺序正确（Edge Case）', () => {
    const store = useNodeStore.getState();
    const aId = store.addNode(null);
    const bId = store.addNode(null);
    const cId = store.addNode(null);

    store.indentNode(cId);
    let state = useNodeStore.getState();
    expect(state.nodes[bId].childrenIds).toEqual([cId]);
    expect(state.nodes[cId].parentId).toBe(bId);

    store.indentNode(bId);
    state = useNodeStore.getState();
    expect(state.nodes[aId].childrenIds).toEqual([bId]);
    expect(state.nodes[bId].childrenIds).toEqual([cId]);
    expect(state.rootIds).toEqual([aId]);
  });

  it('反缩进后 rootIds 与兄弟顺序符合预期（Edge Case）', () => {
    const store = useNodeStore.getState();
    const aId = store.addNode(null);
    const bId = store.addNode(null);
    const cId = store.addNode(null);

    store.indentNode(cId);
    store.indentNode(bId);

    store.outdentNode(bId);
    let state = useNodeStore.getState();
    expect(state.rootIds).toEqual([aId, bId]);
    expect(state.nodes[bId].parentId).toBeNull();
    expect(state.nodes[bId].childrenIds).toEqual([cId]);

    store.outdentNode(cId);
    state = useNodeStore.getState();
    expect(state.rootIds).toEqual([aId, bId, cId]);
  });

  it('删除父节点时会级联删除整棵子树', () => {
    const store = useNodeStore.getState();
    const rootId = store.addNode(null);
    const childId = store.addNode(rootId);
    const grandChildId = store.addNode(childId);

    store.deleteNode(rootId);
    const state = useNodeStore.getState();

    expect(state.nodes[rootId]).toBeUndefined();
    expect(state.nodes[childId]).toBeUndefined();
    expect(state.nodes[grandChildId]).toBeUndefined();
    expect(state.rootIds).toEqual([]);
  });

  it('删除多根场景下某一子树后 rootIds 正确收缩（Edge Case）', () => {
    const store = useNodeStore.getState();
    const r1 = store.addNode(null);
    const c1 = store.addNode(r1);
    const r2 = store.addNode(null);

    store.deleteNode(r1);
    const state = useNodeStore.getState();

    expect(state.nodes[r1]).toBeUndefined();
    expect(state.nodes[c1]).toBeUndefined();
    expect(state.rootIds).toEqual([r2]);
  });

  it('删除不存在节点时保持状态不变（Edge Case）', () => {
    const store = useNodeStore.getState();
    const rootId = store.addNode(null);
    const before = useNodeStore.getState();

    store.deleteNode('non-existent-id');
    const after = useNodeStore.getState();

    expect(after.rootIds).toEqual(before.rootIds);
    expect(after.nodes[rootId]).toBeDefined();
  });
});

import { describe, expect, it, beforeEach } from 'vitest';
import { useSearchNodeStore } from '@/stores/searchNodeStore';

describe('searchNodeStore', () => {
  beforeEach(() => {
    useSearchNodeStore.setState({
      resultsBySearchNodeId: {},
      loadingBySearchNodeId: {},
      errorBySearchNodeId: {},
    });
  });

  it('pruneResultsForDeletedNodes 会从所有搜索结果中移除被删除节点 ID（单个 ID）', () => {
    useSearchNodeStore.setState({
      resultsBySearchNodeId: {
        s1: ['a', 'b', 'c'],
        s2: ['c', 'd'],
      },
      loadingBySearchNodeId: {},
      errorBySearchNodeId: {},
    });

    const store = useSearchNodeStore.getState();
    store.pruneResultsForDeletedNodes('c');

    const state = useSearchNodeStore.getState();
    expect(state.resultsBySearchNodeId.s1).toEqual(['a', 'b']);
    expect(state.resultsBySearchNodeId.s2).toEqual(['d']);
  });

  it('pruneResultsForDeletedNodes 会从所有搜索结果中移除被删除节点 ID（多个 ID）', () => {
    useSearchNodeStore.setState({
      resultsBySearchNodeId: {
        s1: ['a', 'b', 'c'],
        s2: ['c', 'd', 'e'],
      },
      loadingBySearchNodeId: {},
      errorBySearchNodeId: {},
    });

    const store = useSearchNodeStore.getState();
    store.pruneResultsForDeletedNodes(['b', 'c', 'x']);

    const state = useSearchNodeStore.getState();
    expect(state.resultsBySearchNodeId.s1).toEqual(['a']);
    expect(state.resultsBySearchNodeId.s2).toEqual(['d', 'e']);
  });

  it('当没有匹配删除项时不会修改状态', () => {
    useSearchNodeStore.setState({
      resultsBySearchNodeId: {
        s1: ['a', 'b'],
      },
      loadingBySearchNodeId: {},
      errorBySearchNodeId: {},
    });

    const before = useSearchNodeStore.getState().resultsBySearchNodeId;
    const store = useSearchNodeStore.getState();
    store.pruneResultsForDeletedNodes(['x', 'y']);
    const after = useSearchNodeStore.getState().resultsBySearchNodeId;

    expect(after).toBe(before);
  });
}


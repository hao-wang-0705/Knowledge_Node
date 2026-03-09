import { create } from 'zustand';
import type { Node } from '@/types';
import type { SearchConfig, SearchCondition, SearchQuery } from '@/types/search';
import { nodesApi } from '@/services/api/nodes';

interface SearchNodeStoreState {
  resultsBySearchNodeId: Record<string, string[]>;
  loadingBySearchNodeId: Record<string, boolean>;
  errorBySearchNodeId: Record<string, string | null>;
}

interface SearchNodeStoreActions {
  executeSearch: (searchNodeId: string, config?: SearchConfig) => Promise<string[]>;
  refreshSearch: (searchNodeId: string, config?: SearchConfig) => Promise<string[]>;
  clearSearch: (searchNodeId: string) => void;
  evaluateCondition: (node: Node, condition: SearchCondition, allNodes: Record<string, Node>) => boolean;
}

export const useSearchNodeStore = create<SearchNodeStoreState & SearchNodeStoreActions>((set, get) => ({
  resultsBySearchNodeId: {},
  loadingBySearchNodeId: {},
  errorBySearchNodeId: {},

  executeSearch: async (searchNodeId, config) => {
    if (!config || config.conditions.length === 0) {
      set((state) => ({
        resultsBySearchNodeId: { ...state.resultsBySearchNodeId, [searchNodeId]: [] },
        loadingBySearchNodeId: { ...state.loadingBySearchNodeId, [searchNodeId]: false },
        errorBySearchNodeId: { ...state.errorBySearchNodeId, [searchNodeId]: null },
      }));
      return [];
    }

    set((state) => ({
      loadingBySearchNodeId: { ...state.loadingBySearchNodeId, [searchNodeId]: true },
      errorBySearchNodeId: { ...state.errorBySearchNodeId, [searchNodeId]: null },
    }));

    const query: SearchQuery = {
      conditions: config.conditions,
      logicalOperator: config.logicalOperator,
      take: 50,
    };

    try {
      const nodes = await nodesApi.advancedSearch(query);
      const nodeIds = nodes.map((node) => node.id).filter((id) => id !== searchNodeId);
      set((state) => ({
        resultsBySearchNodeId: { ...state.resultsBySearchNodeId, [searchNodeId]: nodeIds },
        loadingBySearchNodeId: { ...state.loadingBySearchNodeId, [searchNodeId]: false },
      }));
      return nodeIds;
    } catch (error) {
      console.error('[searchNodeStore] executeSearch failed:', error);
      const message = error instanceof Error ? error.message : '搜索失败';
      set((state) => ({
        loadingBySearchNodeId: { ...state.loadingBySearchNodeId, [searchNodeId]: false },
        errorBySearchNodeId: { ...state.errorBySearchNodeId, [searchNodeId]: message },
      }));
      return [];
    }
  },

  refreshSearch: async (searchNodeId, config) => {
    return get().executeSearch(searchNodeId, config);
  },

  clearSearch: (searchNodeId) => {
    set((state) => ({
      resultsBySearchNodeId: { ...state.resultsBySearchNodeId, [searchNodeId]: [] },
      loadingBySearchNodeId: { ...state.loadingBySearchNodeId, [searchNodeId]: false },
      errorBySearchNodeId: { ...state.errorBySearchNodeId, [searchNodeId]: null },
    }));
  },

  evaluateCondition: (node, condition, allNodes) => {
    const evaluate = (): boolean => {
      const values = Array.isArray(condition.value) ? condition.value : [condition.value];
      if (condition.type === 'keyword') {
        const text = String(condition.value).toLowerCase();
        return node.content.toLowerCase().includes(text);
      }

      if (condition.type === 'tag') {
        if (condition.operator === 'hasAll') {
          return values.every((value) => typeof value === 'string' && node.tags.includes(value));
        }
        return values.some((value) => typeof value === 'string' && node.tags.includes(value));
      }

      if (condition.type === 'field') {
        if (!condition.field) return false;
        const fieldValue = node.fields[condition.field];
        if (condition.operator === 'contains') {
          return String(fieldValue ?? '').toLowerCase().includes(String(condition.value).toLowerCase());
        }
        if (condition.operator === 'gt') {
          return Number(fieldValue) > Number(condition.value);
        }
        if (condition.operator === 'lt') {
          return Number(fieldValue) < Number(condition.value);
        }
        if (condition.operator === 'gte') {
          return Number(fieldValue) >= Number(condition.value);
        }
        if (condition.operator === 'lte') {
          return Number(fieldValue) <= Number(condition.value);
        }
        return fieldValue === condition.value;
      }

      if (condition.type === 'ancestor') {
        const targetAncestorId = String(condition.value);
        let current = node.parentId ? allNodes[node.parentId] : undefined;
        while (current) {
          if (current.id === targetAncestorId) {
            return true;
          }
          current = current.parentId ? allNodes[current.parentId] : undefined;
        }
      }

      if (condition.type === 'date') {
        const timestamp = node.updatedAt || node.createdAt;
        const date = new Date(timestamp);
        if (condition.operator === 'today') {
          const today = new Date();
          return date.toDateString() === today.toDateString();
        }
        if (condition.operator === 'withinDays') {
          const days = Number(condition.value);
          const delta = Date.now() - date.getTime();
          return delta <= days * 24 * 60 * 60 * 1000;
        }
      }

      return false;
    };

    const matched = evaluate();
    return condition.negate ? !matched : matched;
  },
}));

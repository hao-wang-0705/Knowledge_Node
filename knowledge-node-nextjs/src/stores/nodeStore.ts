import { create } from 'zustand';
import { Node, TemplateNode, SmartCaptureNode, FieldDefinition } from '@/types';
import { generateId, STORAGE_KEYS, CURRENT_DATA_VERSION, debounce } from '@/utils/helpers';
import { getCalendarPath, SYSTEM_TAGS, getCalendarNodeType } from '@/utils/date-helpers';
import {
  findCalendarNodeActualId,
  resolveCalendarParentId,
  initCalendarNodeIdMap,
  setCalendarNodeIdMapping,
} from '@/utils/calendarNodeId';
import { getUserStorageKey, migrateOldData, getUserId } from '@/utils/userStorage';
import { clearClientCaches } from '@/utils/cache';
import { useSupertagStore } from '@/stores/supertagStore';
import { useSyncStore } from '@/stores/syncStore';
import { useSearchNodeStore } from '@/stores/searchNodeStore';
import { useDeconstructPreviewStore } from '@/stores/deconstructPreviewStore';
import {
  queueCreateWithDependency,
  waitForNodeSync,
} from '@/utils/nodeCreationGuard';

// 样例数据初始化 key（内联定义，替代原 sampleData.ts）
const SAMPLE_DATA_INITIALIZED_KEY = 'knowledge-node-sample-initialized';

export const ROOT_NODE_ID = 'root';

/** 按视图隔离的折叠覆盖层，key: `${viewKey}:${nodeId}`，不持久化、不同步 */
const COLLAPSE_OVERLAY_KEY = (viewKey: string, nodeId: string) => `${viewKey}:${nodeId}`;

interface NodeStoreState {
  nodes: Record<string, Node>;
  rootIds: string[];
  focusedNodeId: string | null;
  hoistedNodeId: string | null;
  /** 按视图的折叠状态覆盖层，仅内存，不写 nodes、不持久化 */
  collapseOverlay: Record<string, boolean>;
}

interface NodeStoreActions {
  addNode: (parentId: string | null, afterId?: string) => string;
  addNodes: (newNodes: Record<string, Node>, newRootIds: string[], targetParentId: string | null, afterId?: string) => void;
  addSearchNode: (parentId: string | null, config?: import('@/types/search').SearchConfig, afterId?: string) => string;
  updateNode: (id: string, updates: Partial<Node>) => void;
  deleteNode: (id: string) => void;
  indentNode: (id: string) => void;
  outdentNode: (id: string) => void;
  /** viewKey: 'main' | `search:${searchNodeId}`，仅写 overlay，不持久化 */
  toggleCollapse: (viewKey: string, id: string) => void;
  getCollapseState: (viewKey: string, nodeId: string) => boolean;
  setCollapseState: (viewKey: string, nodeId: string, value: boolean) => void;
  setFocusedNode: (id: string | null) => void;
  setHoistedNode: (id: string | null) => void;
  navigateToNode: (id: string | null) => void;
  ensureNode: (id: string, parentId: string | null, tagId: string | null, content: string) => string;
  /** v3.1: 异步版本，等待同步完成 */
  ensureNodeAsync: (id: string, parentId: string | null, tagId: string | null, content: string) => Promise<string>;
  ensureTodayNode: () => string;
  /** v3.1: 异步版本，串行创建并等待同步 */
  ensureTodayNodeAsync: () => Promise<string>;
  goToToday: () => Promise<void>;
  goToRoot: () => void;
  getNodePath: (nodeId: string) => Node[];
  loadFromStorage: () => void | Promise<void>;
  loadFromAPI: () => Promise<void>;
  saveToStorage: () => void;
  /** 侧边栏入口：user_root 的一级子节点 ID 列表（过滤 daily_root） */
  getSidebarEntries: () => string[];
  /** 是否在 Daily Notes 子树内（从 nodeId 向上遍历经 daily_root） */
  isInDailyTree: (nodeId: string) => boolean;
  initWithMockData: () => void;
  initWithGuideData: () => void;
  /** v2.1: 应用 Supertag 到节点，可选自动填充默认内容模版 */
  applySupertag: (nodeId: string, supertagId: string, options?: { fillTemplateIfEmpty?: boolean }) => void;
  /** 智能解构：将幽灵预览节点树写入为真实节点，替换原节点内容（根节点更新原节点，子节点挂载其下） */
  applyDeconstructPreview: (sourceNodeId: string, nodes: SmartCaptureNode[]) => void;
}

type NodeStore = NodeStoreState & NodeStoreActions;

// 获取用户专属的存储 key
const getNodesKey = () => getUserStorageKey(STORAGE_KEYS.NODES);
const getRootIdsKey = () => getUserStorageKey(STORAGE_KEYS.ROOT_IDS);
const getVersionKey = () => getUserStorageKey(STORAGE_KEYS.DATA_VERSION);

const debouncedSave = debounce((nodes: Record<string, Node>, rootIds: string[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getNodesKey(), JSON.stringify(nodes));
  localStorage.setItem(getRootIdsKey(), JSON.stringify(rootIds));
}, 500);

// ============ 数据库同步 API（通过 SyncStore 队列） ============

/**
 * 将节点创建操作加入同步队列
 * v3.1 增强：使用 nodeCreationGuard 进行依赖追踪
 * @param node 待创建的节点
 * @param sortOrder 排序顺序
 * @param awaitSync 是否等待同步完成（用于日历节点串行创建）
 */
const queueCreateNode = (
  node: Node,
  sortOrder: number = 0,
  awaitSync: boolean = false
): void | Promise<boolean> => {
  const nodeStore = useNodeStore.getState();
  
  // 使用 nodeCreationGuard 进行统一入队
  const result = queueCreateWithDependency({
    node,
    sortOrder,
    awaitSync,
    nodes: nodeStore.nodes,
  });

  // 如果需要等待同步完成，返回 Promise
  if (awaitSync && result instanceof Promise) {
    return result.then((r) => r.queued);
  }
  
  // 记录未能入队的情况（通常是校验失败）
  if (!(result instanceof Promise) && !result.queued) {
    console.error(`[queueCreateNode] 节点 ${node.id} 入队失败:`, result.error);
  }
};

/**
 * 更新节点到数据库（通过同步队列，内置合并逻辑）
 * 仅传递已定义字段，避免 undefined 覆盖 pending create 中的 parentId 等字段
 */
const queueUpdateNode = (nodeId: string, updates: Partial<Node> & { sortOrder?: number }) => {
  const syncStore = useSyncStore.getState();

  const payload: Record<string, unknown> = {};
  if (updates.content !== undefined) payload.content = updates.content;
  if (updates.parentId !== undefined) payload.parentId = updates.parentId;
  if (updates.type !== undefined) payload.nodeType = updates.type;
  if (updates.supertagId !== undefined) payload.supertagId = updates.supertagId;
  if (updates.fields !== undefined) payload.fields = updates.fields;
  if (updates.payload !== undefined) payload.payload = updates.payload;
  // 展开/收起为纯前端状态，不同步到后端
  if (updates.tags !== undefined) payload.tags = updates.tags;
  if (updates.references !== undefined) payload.references = updates.references;
  if (updates.sortOrder !== undefined) payload.sortOrder = updates.sortOrder;

  if (Object.keys(payload).length === 0) return;

  syncStore.queueOperation({
    type: 'update',
    entityType: 'node',
    entityId: nodeId,
    payload,
  });
};

/**
 * 删除节点（通过同步队列）
 */
const queueDeleteNode = (nodeId: string) => {
  const syncStore = useSyncStore.getState();
  
  syncStore.queueOperation({
    type: 'delete',
    entityType: 'node',
    entityId: nodeId,
    payload: {},
  });
};

/**
 * 将指定父节点下的兄弟节点顺序同步到数据库。
 * 约束：数据库层采用 parentId + sortOrder 表示层级与顺序，需确保其与前端 childrenIds 一致。
 */
const queueSortOrderSyncForParent = (
  parentId: string | null,
  nodes: Record<string, Node>,
  rootIds: string[],
  skipNodeIds: Set<string> = new Set()
) => {
  const siblingIds =
    parentId === null ? rootIds : nodes[parentId]?.childrenIds ?? [];

  siblingIds.forEach((siblingId, index) => {
    if (skipNodeIds.has(siblingId)) return;
    queueUpdateNode(siblingId, { parentId, sortOrder: index });
  });
};

/** 从数据库加载节点（统一树：一次拉取全部） */
const loadNodesFromDB = async (): Promise<{ nodes: Record<string, Node>; rootIds: string[] } | null> => {
  try {
    const nodesRes = await fetch('/api/nodes');

    if (!nodesRes.ok) {
      const data = await nodesRes.json();
      console.error('[loadNodesFromDB] Failed:', data.error);
      return null;
    }
    const data = await nodesRes.json();
    if (!data.success || !Array.isArray(data.data)) {
      return null;
    }

    const nodes: Record<string, Node> = {};
    const rootIds: string[] = [];
    const childrenBuckets = new Map<string, Array<{ id: string; sortOrder: number; createdAt: number }>>();
    let userRootId: string | null = null;

    for (const node of data.data) {
      nodes[node.id] = {
        id: node.id,
        content: node.content,
        type: node.type,
        parentId: node.parentId,
        childrenIds: [],
        isCollapsed: node.isCollapsed,
        tags: node.tags || [],
        references: node.references || [],
        supertagId: node.supertagId,
        nodeRole: node.nodeRole,
        fields: node.fields || {},
        payload: node.payload,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      };

      if (node.nodeRole === 'user_root') {
        userRootId = node.id;
      }
      if (node.parentId) {
        const bucket = childrenBuckets.get(node.parentId) ?? [];
        bucket.push({
          id: node.id,
          sortOrder: typeof node.sortOrder === 'number' ? node.sortOrder : 0,
          createdAt: typeof node.createdAt === 'number' ? node.createdAt : 0,
        });
        childrenBuckets.set(node.parentId, bucket);
      }
      if (!node.parentId) {
        rootIds.push(node.id);
      }
    }

    childrenBuckets.forEach((items, parentId) => {
      const parent = nodes[parentId];
      if (!parent) return;
      const ordered = [...items].sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.createdAt - b.createdAt;
      });
      parent.childrenIds = ordered.map((item) => item.id);
    });

    return { nodes, rootIds: userRootId ? [userRootId] : rootIds };
  } catch (error) {
    console.error('[loadNodesFromDB] Error:', error);
    return null;
  }
};

// ============ Store ============

export const useNodeStore = create<NodeStoreState & NodeStoreActions & { mergeNodeFromServer: (node: Node) => void }>((set, get) => ({
  nodes: {},
  rootIds: [],
  focusedNodeId: null,
  hoistedNodeId: null,
  collapseOverlay: {},

  addNode: (parentId, afterId) => {
    const newId = generateId();
    let createdNode: Node | null = null;
    let resolvedParentId: string | null | undefined = null;
    let aborted = false;

    set((state) => {
      // 仅当调用方显式传 null 时允许根插入；否则解析父节点，undefined 表示未知父节点则中止创建
      resolvedParentId = resolveCalendarParentId(parentId, state.nodes);
      if (resolvedParentId === undefined) {
        console.error('[addNode] 父节点无法解析（未传或日历父未就绪），中止创建');
        aborted = true;
        return state;
      }
      const effectiveParentId: string | null = resolvedParentId;

      const newNode: Node = {
        id: newId,
        content: '',
        parentId: effectiveParentId,
        childrenIds: [],
        isCollapsed: false,
        nodeRole: 'normal',
        tags: [],
        fields: {},
        createdAt: Date.now(),
      };
      createdNode = newNode;

      const newNodes = { ...state.nodes, [newId]: newNode };
      let newRootIds = [...state.rootIds];

      if (effectiveParentId === null) {
        if (afterId) {
          const afterIndex = newRootIds.indexOf(afterId);
          newRootIds.splice(afterIndex !== -1 ? afterIndex + 1 : newRootIds.length, 0, newId);
        } else {
          newRootIds.push(newId);
        }
      } else {
        const parentNode = newNodes[effectiveParentId];
        if (!parentNode) {
          console.error(`[addNode] 父节点 ${effectiveParentId} 不存在，回滚本地创建`);
          aborted = true;
          return state;
        }
        const newChildrenIds = [...parentNode.childrenIds];
        const isCalendarParent =
          effectiveParentId.includes('year-') ||
          effectiveParentId.includes('week-');

        if (afterId) {
          const resolvedAfterId = resolveCalendarParentId(afterId, state.nodes);
          const actualAfterId = typeof resolvedAfterId === 'string' ? resolvedAfterId : afterId;
          const afterIndex = newChildrenIds.indexOf(actualAfterId);
          newChildrenIds.splice(afterIndex !== -1 ? afterIndex + 1 : newChildrenIds.length, 0, newId);
        } else if (isCalendarParent) {
          let lastCalendarChildIndex = -1;
          for (let i = 0; i < newChildrenIds.length; i++) {
            const childId = newChildrenIds[i];
            const isCalendarChild =
              childId.includes('year-') ||
              childId.includes('week-') ||
              childId.includes('day-');
            if (isCalendarChild) lastCalendarChildIndex = i;
          }
          newChildrenIds.splice(lastCalendarChildIndex + 1, 0, newId);
        } else {
          newChildrenIds.push(newId);
        }
        newNodes[effectiveParentId] = { ...parentNode, childrenIds: newChildrenIds };
      }

      debouncedSave(newNodes, newRootIds);
      return { nodes: newNodes, rootIds: newRootIds, focusedNodeId: newId };
    });

    if (aborted) {
      throw new Error('无法创建节点：父节点未就绪或不存在，请稍后重试');
    }
    const updatedState = get();
    const parentIdForSync: string | null = resolvedParentId ?? null;
    const sortOrder =
      parentIdForSync != null
        ? updatedState.nodes[parentIdForSync]?.childrenIds.indexOf(newId) ?? 0
        : updatedState.rootIds.indexOf(newId);
    queueCreateNode(createdNode!, sortOrder);
    queueSortOrderSyncForParent(
      parentIdForSync,
      updatedState.nodes,
      updatedState.rootIds,
      new Set([newId])
    );
    return newId;
  },

  addNodes: (newNodes, newRootIds, targetParentId, afterId) => {
    const state = get();
    const resolvedTargetParentId =
      targetParentId === null
        ? null
        : resolveCalendarParentId(targetParentId, state.nodes);
    if (resolvedTargetParentId === undefined) {
      console.error('[addNodes] 目标父节点无法解析，中止批量添加');
      throw new Error('无法添加节点：目标父节点未就绪或不存在');
    }
    const nodesToSync: Array<{ node: Node; sortOrder: number }> = [];

    set((state) => {
      const mergedNodes = { ...state.nodes, ...newNodes };
      let mergedRootIds = [...state.rootIds];

      if (resolvedTargetParentId === null) {
        if (afterId) {
          const afterIndex = mergedRootIds.indexOf(afterId);
          mergedRootIds.splice(afterIndex !== -1 ? afterIndex + 1 : mergedRootIds.length, 0, ...newRootIds);
        } else {
          mergedRootIds = [...mergedRootIds, ...newRootIds];
        }
        // 收集根节点用于同步
        newRootIds.forEach((rootId, index) => {
          const node = mergedNodes[rootId];
          if (node) {
            nodesToSync.push({ node, sortOrder: mergedRootIds.indexOf(rootId) });
          }
        });
      } else {
        const parentNode = mergedNodes[resolvedTargetParentId];
        if (!parentNode) {
          console.error(`[addNodes] 父节点 ${resolvedTargetParentId} 不存在，中止批量添加`);
          throw new Error('无法添加节点：目标父节点不存在');
        }
        for (const rootId of newRootIds) {
          if (mergedNodes[rootId]) {
            mergedNodes[rootId] = { ...mergedNodes[rootId], parentId: resolvedTargetParentId };
          }
        }
        let newChildrenIds = [...parentNode.childrenIds];
        if (afterId) {
          const afterIndex = newChildrenIds.indexOf(afterId);
          newChildrenIds.splice(afterIndex !== -1 ? afterIndex + 1 : newChildrenIds.length, 0, ...newRootIds);
        } else {
          newChildrenIds = [...newChildrenIds, ...newRootIds];
        }
        mergedNodes[resolvedTargetParentId] = { ...parentNode, childrenIds: newChildrenIds };

        newRootIds.forEach((rootId) => {
          const node = mergedNodes[rootId];
          if (node) {
            nodesToSync.push({
              node,
              sortOrder: newChildrenIds.indexOf(rootId),
            });
          }
        });
      }

      debouncedSave(mergedNodes, mergedRootIds);
      return { nodes: mergedNodes, rootIds: mergedRootIds };
    });

    // v3.1 修复：入同步队列（递归同步所有新节点）
    const syncAllNodes = (nodeId: string, sortOrder: number) => {
      const updatedState = get();
      const node = updatedState.nodes[nodeId];
      if (!node) return;
      
      queueCreateNode(node, sortOrder);
      
      // 递归同步子节点
      node.childrenIds.forEach((childId, index) => {
        syncAllNodes(childId, index);
      });
    };

    nodesToSync.forEach(({ node, sortOrder }) => {
      syncAllNodes(node.id, sortOrder);
    });
  },

  addSearchNode: (parentId, config, afterId) => {
    const newId = generateId();
    const state = get();
    const resolvedParentId = resolveCalendarParentId(parentId, state.nodes);
    if (resolvedParentId === undefined) {
      console.error('[addSearchNode] 父节点无法解析，中止创建');
      throw new Error('无法创建搜索节点：父节点未就绪或不存在');
    }

    const newNode: Node = {
      id: newId,
      content: config?.label || '🔎 搜索节点',
      type: 'search',
      parentId: resolvedParentId,
      childrenIds: [],
      isCollapsed: false,
      tags: [],
      fields: {},
      createdAt: Date.now(),
      payload: config || { conditions: [], logicalOperator: 'AND' },
    };

    let sortOrder = 0;
    set((currentState) => {
      const newNodes = { ...currentState.nodes, [newId]: newNode };
      let newRootIds = [...currentState.rootIds];

      if (resolvedParentId === null) {
        if (afterId) {
          const afterIndex = newRootIds.indexOf(afterId);
          newRootIds.splice(afterIndex !== -1 ? afterIndex + 1 : newRootIds.length, 0, newId);
        } else {
          newRootIds.push(newId);
        }
        sortOrder = newRootIds.indexOf(newId);
      } else {
        const parentNode = newNodes[resolvedParentId];
        if (!parentNode) {
          console.error(`[addSearchNode] 父节点 ${resolvedParentId} 不存在，中止创建`);
          throw new Error('无法创建搜索节点：父节点不存在');
        }

        const newChildrenIds = [...parentNode.childrenIds];
        if (afterId) {
          const afterIndex = newChildrenIds.indexOf(afterId);
          newChildrenIds.splice(afterIndex !== -1 ? afterIndex + 1 : newChildrenIds.length, 0, newId);
        } else {
          newChildrenIds.push(newId);
        }
        newNodes[resolvedParentId] = { ...parentNode, childrenIds: newChildrenIds };
        sortOrder = newChildrenIds.indexOf(newId);
      }

      debouncedSave(newNodes, newRootIds);
      return { nodes: newNodes, rootIds: newRootIds, focusedNodeId: newId };
    });

    queueCreateNode(newNode, sortOrder);
    return newId;
  },

  updateNode: (id, updates) => {
    set((state) => {
      const existingNode = state.nodes[id];
      if (!existingNode) return state;
      const newNodes = { ...state.nodes, [id]: { ...existingNode, ...updates } };
      debouncedSave(newNodes, state.rootIds);
      return { nodes: newNodes };
    });
    
    // 异步同步到数据库（通过同步队列）
    queueUpdateNode(id, updates);
  },

  mergeNodeFromServer: (node) => {
    set((state) => {
      const existing = state.nodes[node.id];
      const merged: Node = existing ? { ...existing, ...node } : node;
      const newNodes = { ...state.nodes, [node.id]: merged };
      debouncedSave(newNodes, state.rootIds);
      return { nodes: newNodes };
    });
  },

  deleteNode: (id) => {
    // 收集要删除的节点 ID（在 set 外部收集，以便后续同步到数据库）
    const state = get();
    const nodesToDelete = new Set<string>();
    const collectNodesToDelete = (nodeId: string) => {
      nodesToDelete.add(nodeId);
      const n = state.nodes[nodeId];
      if (n) n.childrenIds.forEach(collectNodesToDelete);
    };
    collectNodesToDelete(id);
    
    let oldParentId: string | null = null;

    set((state) => {
      const targetNode = state.nodes[id];
      if (!targetNode) return state;
      oldParentId = targetNode.parentId;

      const newNodes = { ...state.nodes };
      nodesToDelete.forEach((nodeId) => delete newNodes[nodeId]);

      const newRootIds = state.rootIds.filter((rootId) => !nodesToDelete.has(rootId));

      if (targetNode.parentId && newNodes[targetNode.parentId]) {
        const parentNode = newNodes[targetNode.parentId];
        newNodes[targetNode.parentId] = {
          ...parentNode,
          childrenIds: parentNode.childrenIds.filter((childId) => childId !== id),
        };
      }

      debouncedSave(newNodes, newRootIds);
      return { nodes: newNodes, rootIds: newRootIds };
    });
    
    // 异步同步删除到数据库（通过同步队列，只删除根节点，子节点由数据库级联删除）
    queueDeleteNode(id);

    // 删除后，从所有搜索结果中清理被删除节点，避免结果中残留无效 ID
    try {
      const searchStore = useSearchNodeStore.getState();
      searchStore.pruneResultsForDeletedNodes(Array.from(nodesToDelete));
    } catch (error) {
      console.error('[nodeStore] prune search results after delete failed:', error);
    }

    // 同步删除后的同级顺序，避免 sortOrder 与前端结构漂移
    const updatedState = get();
    queueSortOrderSyncForParent(oldParentId, updatedState.nodes, updatedState.rootIds);
  },

  indentNode: (id) => {
    let oldParentId: string | null = null;
    let newParentId: string | null = null;
    let moved = false;

    set((state) => {
      const targetNode = state.nodes[id];
      if (!targetNode) return state;

      const siblings = targetNode.parentId === null 
        ? state.rootIds 
        : (state.nodes[targetNode.parentId]?.childrenIds || []);

      const currentIndex = siblings.indexOf(id);
      if (currentIndex <= 0) return state;

      const nextParentId = siblings[currentIndex - 1];
      const newParent = state.nodes[nextParentId];
      if (!newParent) return state;

      const newNodes = { ...state.nodes };
      let newRootIds = [...state.rootIds];
      oldParentId = targetNode.parentId;
      newParentId = nextParentId;
      moved = true;

      newNodes[id] = { ...targetNode, parentId: newParentId };
      newNodes[newParentId] = { ...newParent, childrenIds: [...newParent.childrenIds, id] };

      if (targetNode.parentId === null) {
        newRootIds = newRootIds.filter((rootId) => rootId !== id);
      } else if (newNodes[targetNode.parentId]) {
        const oldParent = newNodes[targetNode.parentId];
        newNodes[targetNode.parentId] = {
          ...oldParent,
          childrenIds: oldParent.childrenIds.filter((childId) => childId !== id),
        };
      }

      debouncedSave(newNodes, newRootIds);
      return { nodes: newNodes, rootIds: newRootIds };
    });

    if (!moved) return;

    const updatedState = get();
    const movedSortOrder = newParentId
      ? updatedState.nodes[newParentId]?.childrenIds.indexOf(id) ?? 0
      : updatedState.rootIds.indexOf(id);

    queueUpdateNode(id, { parentId: newParentId, sortOrder: movedSortOrder });

    const syncParentIds = new Set<string | null>([oldParentId, newParentId]);
    syncParentIds.forEach((parentId) => {
      queueSortOrderSyncForParent(parentId, updatedState.nodes, updatedState.rootIds, new Set([id]));
    });
  },

  outdentNode: (id) => {
    let oldParentId: string | null = null;
    let newParentId: string | null = null;
    let moved = false;

    set((state) => {
      const targetNode = state.nodes[id];
      if (!targetNode || targetNode.parentId === null) return state;

      const parentNode = state.nodes[targetNode.parentId];
      if (!parentNode) return state;

      const newNodes = { ...state.nodes };
      let newRootIds = [...state.rootIds];
      oldParentId = targetNode.parentId;

      newParentId = parentNode.parentId;
      moved = true;
      newNodes[id] = { ...targetNode, parentId: newParentId };
      newNodes[targetNode.parentId] = {
        ...parentNode,
        childrenIds: parentNode.childrenIds.filter((childId) => childId !== id),
      };

      if (newParentId === null) {
        const parentRootIndex = newRootIds.indexOf(targetNode.parentId);
        newRootIds.splice(parentRootIndex + 1, 0, id);
      } else if (newNodes[newParentId]) {
        const grandParent = newNodes[newParentId];
        const parentIndex = grandParent.childrenIds.indexOf(targetNode.parentId);
        const newChildrenIds = [...grandParent.childrenIds];
        newChildrenIds.splice(parentIndex + 1, 0, id);
        newNodes[newParentId] = { ...grandParent, childrenIds: newChildrenIds };
      }

      debouncedSave(newNodes, newRootIds);
      return { nodes: newNodes, rootIds: newRootIds };
    });

    if (!moved) return;

    const updatedState = get();
    const movedSortOrder = newParentId
      ? updatedState.nodes[newParentId]?.childrenIds.indexOf(id) ?? 0
      : updatedState.rootIds.indexOf(id);

    queueUpdateNode(id, { parentId: newParentId, sortOrder: movedSortOrder });

    const syncParentIds = new Set<string | null>([oldParentId, newParentId]);
    syncParentIds.forEach((parentId) => {
      queueSortOrderSyncForParent(parentId, updatedState.nodes, updatedState.rootIds, new Set([id]));
    });
  },

  toggleCollapse: (viewKey, id) => {
    const state = get();
    const node = state.nodes[id];
    if (!node) return;
    const key = COLLAPSE_OVERLAY_KEY(viewKey, id);
    const current = key in state.collapseOverlay
      ? state.collapseOverlay[key]
      : node.isCollapsed;
    set((s) => ({
      collapseOverlay: { ...s.collapseOverlay, [key]: !current },
    }));
  },

  getCollapseState: (viewKey, nodeId) => {
    const state = get();
    const key = COLLAPSE_OVERLAY_KEY(viewKey, nodeId);
    if (key in state.collapseOverlay) return state.collapseOverlay[key];
    return state.nodes[nodeId]?.isCollapsed ?? false;
  },

  setCollapseState: (viewKey, nodeId, value) => {
    const key = COLLAPSE_OVERLAY_KEY(viewKey, nodeId);
    set((s) => ({ collapseOverlay: { ...s.collapseOverlay, [key]: value } }));
  },

  setFocusedNode: (id) => set({ focusedNodeId: id }),

  setHoistedNode: (id) =>
    set((state) => {
      if (id === null) return { hoistedNodeId: null, focusedNodeId: null };
      if (state.nodes[id]) return { hoistedNodeId: id, focusedNodeId: id };
      console.error(`[setHoistedNode] 目标节点不存在: ${id}`);
      return state;
    }),

  navigateToNode: (id) =>
    set((state) => {
      if (id === null) {
        return { hoistedNodeId: null, focusedNodeId: null };
      }
      if (!state.nodes[id]) {
        console.error(`[navigateToNode] 目标节点不存在: ${id}`);
        return state;
      }
      return { hoistedNodeId: id, focusedNodeId: id };
    }),

  /**
   * 确保节点存在（如果不存在则创建）
   * 对于日历节点，会检查是否已存在带前缀的版本；若已存在但 parentId 错误则执行 reparent
   * v3.1 增强：支持 awaitSync 参数，等待同步完成
   */
  ensureNode: (id, parentId, tagId, content) => {
    const isCalendarNode = getCalendarNodeType(id) !== null;
    let nodeToSync: Node | null = null;
    let actualParentIdForSync: string | null = null;
    let wasCreated = false;
    let createAborted = false;
    let actualIdForReturn = id;
    let sortOrder = 0;

    set((currentState) => {
      const resolvedParentId =
        resolveCalendarParentId(parentId, currentState.nodes);

      if (isCalendarNode) {
        const actualId = findCalendarNodeActualId(id, currentState.nodes);
        if (actualId) {
          setCalendarNodeIdMapping(id, actualId);
          actualIdForReturn = actualId;
          const existingNode = currentState.nodes[actualId];
          if (!existingNode) return currentState;

          if (resolvedParentId !== undefined && existingNode.parentId !== resolvedParentId) {
            console.log(`[ensureNode] reparent 日历节点 ${actualId}: ${existingNode.parentId} -> ${resolvedParentId}`);
            const newNodes = { ...currentState.nodes };
            const oldParentId = existingNode.parentId;

            if (oldParentId && newNodes[oldParentId]) {
              const oldParent = newNodes[oldParentId];
              newNodes[oldParentId] = {
                ...oldParent,
                childrenIds: oldParent.childrenIds.filter((cid) => cid !== actualId),
              };
            }

            let newRootIds = [...currentState.rootIds];
            if (oldParentId === null) {
              newRootIds = newRootIds.filter((rid) => rid !== actualId);
            }
            if (resolvedParentId === null) {
              if (!newRootIds.includes(actualId)) newRootIds.push(actualId);
            } else if (newNodes[resolvedParentId]) {
              const newParent = newNodes[resolvedParentId];
              if (!newParent.childrenIds.includes(actualId)) {
                newNodes[resolvedParentId] = {
                  ...newParent,
                  childrenIds: [...newParent.childrenIds, actualId],
                };
              }
            }

            newNodes[actualId] = { ...existingNode, parentId: resolvedParentId };
            debouncedSave(newNodes, newRootIds);

            sortOrder = resolvedParentId
              ? newNodes[resolvedParentId]?.childrenIds.indexOf(actualId) ?? 0
              : newRootIds.indexOf(actualId);
            queueUpdateNode(actualId, { parentId: resolvedParentId, sortOrder });
            return { nodes: newNodes, rootIds: newRootIds };
          }
          return currentState;
        }
      } else if (currentState.nodes[id]) {
        return currentState;
      }

      if (resolvedParentId === undefined) {
        console.error('[ensureNode] 父节点无法解析，中止创建节点', id);
        createAborted = true;
        return currentState;
      }

      actualParentIdForSync = resolvedParentId;
      const newNode: Node = {
        id,
        content,
        parentId: actualParentIdForSync,
        childrenIds: [],
        isCollapsed: false,
        nodeRole: 'normal',
        tags: tagId ? [tagId] : [],
        fields: {},
        createdAt: Date.now(),
      };
      nodeToSync = newNode;
      wasCreated = true;

      const newNodes = { ...currentState.nodes, [id]: newNode };
      let newRootIds = [...currentState.rootIds];

      if (actualParentIdForSync === null) {
        if (!newRootIds.includes(id)) newRootIds.push(id);
        sortOrder = newRootIds.indexOf(id);
      } else {
        const parentNode = newNodes[actualParentIdForSync];
        if (!parentNode) {
          createAborted = true;
          wasCreated = false;
          nodeToSync = null;
          return currentState;
        }
        if (!parentNode.childrenIds.includes(id)) {
          newNodes[actualParentIdForSync] = {
            ...parentNode,
            childrenIds: [...parentNode.childrenIds, id],
          };
        }
        sortOrder = newNodes[actualParentIdForSync].childrenIds.indexOf(id);
      }

      if (isCalendarNode) setCalendarNodeIdMapping(id, id);
      debouncedSave(newNodes, newRootIds);
      return { nodes: newNodes, rootIds: newRootIds };
    });

    if (createAborted) {
      throw new Error('无法创建节点：父节点未就绪或不存在');
    }
    if (wasCreated && nodeToSync) {
      queueCreateNode(nodeToSync, sortOrder);
    }

    return actualIdForReturn;
  },

  /**
   * 确保节点存在并等待同步完成（异步版本）
   * 用于日历节点串行创建场景
   */
  ensureNodeAsync: async (id: string, parentId: string | null, tagId: string | null, content: string): Promise<string> => {
    const { ensureNode } = get();
    const isCalendarNode = getCalendarNodeType(id) !== null;
    
    // 检查节点是否已存在
    const state = get();
    const existingId = isCalendarNode 
      ? findCalendarNodeActualId(id, state.nodes) 
      : (state.nodes[id] ? id : null);
    
    if (existingId) {
      // 节点已存在，无需等待同步
      return existingId;
    }
    
    // 创建节点
    const actualId = ensureNode(id, parentId, tagId, content);
    
    // 等待同步完成
    const syncSuccess = await waitForNodeSync(actualId, 15000); // 15秒超时
    if (!syncSuccess) {
      console.warn(`[ensureNodeAsync] 节点 ${actualId} 同步等待超时或失败`);
    }
    
    return actualId;
  },

  goToToday: async () => {
    const { ensureTodayNode, setHoistedNode } = get();
    const state = get();
    const calendarPath = getCalendarPath(new Date());
    
    // 先尝试查找已存在的日期节点（可能带前缀）
    const existingDayId = findCalendarNodeActualId(calendarPath.dayId, state.nodes);
    
    if (existingDayId) {
      console.log('[goToToday] 找到已存在的日期节点:', existingDayId);
      setHoistedNode(existingDayId);
      return;
    }

    try {
      // 节点不存在，先尝试本地严格创建
      const dayId = ensureTodayNode();
      setHoistedNode(dayId);
      return;
    } catch (error) {
      console.warn('[goToToday] 本地确保今日节点失败，尝试服务端初始化:', error);
    }

    // 服务端初始化（结构修复优先），然后强制重载
    const initRes = await fetch('/api/nodes/init-daily', { method: 'POST' });
    if (!initRes.ok) {
      throw new Error(`初始化 Daily Notes 失败（HTTP ${initRes.status}）`);
    }

    await get().loadFromAPI();
    const reloadedDayId = findCalendarNodeActualId(calendarPath.dayId, get().nodes);
    if (!reloadedDayId) {
      throw new Error('初始化后仍未找到今日节点，请检查后端初始化链路');
    }
    setHoistedNode(reloadedDayId);
  },

  /**
   * 确保今天的日历节点存在（daily_root -> 年->周->日）
   * 用于应用启动时自动创建当天日记
   * 返回实际的日期节点 ID（可能带前缀）
   * 
   * 注意：此方法是同步的，日历节点可能还未同步到后端
   * 如需等待同步完成，请使用 ensureTodayNodeAsync
   */
  ensureTodayNode: () => {
    const { ensureNode } = get();
    const state = get();
    const calendarPath = getCalendarPath(new Date());

    const dailyRootId =
      Object.values(state.nodes).find((n) => n.nodeRole === 'daily_root')?.id ?? null;

    if (dailyRootId === null) {
      throw new Error('daily_root 缺失，拒绝创建今日节点以避免错误挂根');
    }

    const actualYearId = ensureNode(
      calendarPath.yearId,
      dailyRootId,
      SYSTEM_TAGS.YEAR,
      calendarPath.yearContent
    );
    const resolvedYearId = findCalendarNodeActualId(calendarPath.yearId, get().nodes) || actualYearId;

    const actualWeekId = ensureNode(
      calendarPath.weekId,
      resolvedYearId,
      SYSTEM_TAGS.WEEK,
      calendarPath.weekContent
    );
    const resolvedWeekId = findCalendarNodeActualId(calendarPath.weekId, get().nodes) || actualWeekId;

    const actualDayId = ensureNode(
      calendarPath.dayId,
      resolvedWeekId,
      SYSTEM_TAGS.DAY,
      calendarPath.dayContent
    );

    console.log('[ensureTodayNode] 日历节点已确保 (年->周->日):', {
      dailyRootId,
      year: actualYearId,
      week: actualWeekId,
      day: actualDayId,
    });

    return findCalendarNodeActualId(calendarPath.dayId, get().nodes) || actualDayId;
  },

  /**
   * v3.1: 异步版本的 ensureTodayNode
   * 串行创建日历节点（年->周->日），并等待每个节点同步完成后再创建下一个
   * 确保后端按正确顺序创建节点，避免父节点不存在错误
   */
  ensureTodayNodeAsync: async () => {
    const { ensureNodeAsync } = get();
    const state = get();
    const calendarPath = getCalendarPath(new Date());

    const dailyRootId =
      Object.values(state.nodes).find((n) => n.nodeRole === 'daily_root')?.id ?? null;

    if (dailyRootId === null && Object.keys(state.nodes).length > 0) {
      console.warn('[ensureTodayNodeAsync] daily_root 未找到但已有节点，可能竞态');
    }

    console.log('[ensureTodayNodeAsync] 开始串行创建日历节点...');

    // 1. 创建年节点并等待同步
    const actualYearId = await ensureNodeAsync(
      calendarPath.yearId,
      dailyRootId,
      SYSTEM_TAGS.YEAR,
      calendarPath.yearContent
    );
    console.log('[ensureTodayNodeAsync] 年节点已创建:', actualYearId);

    // 2. 创建周节点并等待同步（使用年节点作为父节点）
    const resolvedYearId = findCalendarNodeActualId(calendarPath.yearId, get().nodes) || actualYearId;
    const actualWeekId = await ensureNodeAsync(
      calendarPath.weekId,
      resolvedYearId,
      SYSTEM_TAGS.WEEK,
      calendarPath.weekContent
    );
    console.log('[ensureTodayNodeAsync] 周节点已创建:', actualWeekId);

    // 3. 创建日节点并等待同步（使用周节点作为父节点）
    const resolvedWeekId = findCalendarNodeActualId(calendarPath.weekId, get().nodes) || actualWeekId;
    const actualDayId = await ensureNodeAsync(
      calendarPath.dayId,
      resolvedWeekId,
      SYSTEM_TAGS.DAY,
      calendarPath.dayContent
    );
    console.log('[ensureTodayNodeAsync] 日节点已创建:', actualDayId);

    console.log('[ensureTodayNodeAsync] 日历节点串行创建完成 (年->周->日):', {
      dailyRootId,
      year: actualYearId,
      week: actualWeekId,
      day: actualDayId,
    });

    return findCalendarNodeActualId(calendarPath.dayId, get().nodes) || actualDayId;
  },

  goToRoot: () => set({ hoistedNodeId: null, focusedNodeId: null }),

  getNodePath: (nodeId: string): Node[] => {
    const storeNodes = get().nodes;
    const path: Node[] = [];
    let currentId: string | null = nodeId;

    while (currentId !== null) {
      const n: Node | undefined = storeNodes[currentId];
      if (n) {
        path.unshift(n);
        currentId = n.parentId;
      } else {
        currentId = null;
      }
    }

    return path;
  },

  loadFromStorage: () => {
    // 初始化 syncStore
    const syncStore = useSyncStore.getState();
    if (!syncStore.isInitialized) {
      syncStore.initialize();
    }
    
    // 尝试迁移旧版数据
    migrateOldData();
    
    const storedVersion = localStorage.getItem(getVersionKey());
    
    console.log('[NodeStore] 加载数据...', { 
      storedVersion, 
      currentVersion: CURRENT_DATA_VERSION, 
      isOnline: syncStore.isOnline 
    });
    
    // 检查是否需要初始化样例数据（用户专属的 key）
    const sampleDataKey = getUserStorageKey(SAMPLE_DATA_INITIALIZED_KEY);
    
    // 判断网络状态，决定加载策略
    if (syncStore.isOnline) {
      // ====== 在线模式：数据库优先（可 await，ADR-005） ======
      syncStore.setStatus('syncing');
      return (async () => {
        try {
          const dbData = await loadNodesFromDB();

          if (dbData && Object.keys(dbData.nodes).length > 0) {
            console.log('[NodeStore] 从数据库加载数据:', { nodesCount: Object.keys(dbData.nodes).length });
            set({ nodes: dbData.nodes, rootIds: dbData.rootIds });
            initCalendarNodeIdMap(dbData.nodes);
            localStorage.setItem(getNodesKey(), JSON.stringify(dbData.nodes));
            localStorage.setItem(getRootIdsKey(), JSON.stringify(dbData.rootIds));
            syncStore.setStatus('synced');
            if (syncStore.pendingOperations.length > 0) {
              setTimeout(() => syncStore.processQueue(), 100);
            }
          } else {
            console.log('[NodeStore] 数据库无数据，清空本地缓存以保持一致');
            clearClientCaches({ clearUserIdentity: false, clearQueryCache: true });
            syncStore.clearQueue();
            set({ nodes: {}, rootIds: [], hoistedNodeId: null, focusedNodeId: null });
            localStorage.setItem(getVersionKey(), CURRENT_DATA_VERSION);
            localStorage.removeItem(sampleDataKey);
            syncStore.setStatus('synced');
            if (syncStore.pendingOperations.length > 0) {
              setTimeout(() => syncStore.processQueue(), 100);
            }
          }
        } catch (error) {
          console.error('[NodeStore] 数据库加载失败:', error);
          syncStore.setStatus('error');
          syncStore.setError('数据库连接失败，使用本地缓存');
          const nodesJson = localStorage.getItem(getNodesKey());
          const rootIdsJson = localStorage.getItem(getRootIdsKey());
          if (nodesJson && rootIdsJson) {
            try {
              const parsedNodes = JSON.parse(nodesJson);
              const parsedRootIds = JSON.parse(rootIdsJson);
              set({ nodes: parsedNodes, rootIds: parsedRootIds });
              initCalendarNodeIdMap(parsedNodes);
            } catch (e) {
              console.error('[NodeStore] 降级加载失败:', e);
            }
          }
        }
      })();
    } else {
      // ====== 离线模式：直接使用 localStorage ======
      console.log('[NodeStore] 离线模式，使用本地缓存');
      syncStore.setStatus('offline');
      
      const nodesJson = localStorage.getItem(getNodesKey());
      const rootIdsJson = localStorage.getItem(getRootIdsKey());
      
      if (nodesJson && rootIdsJson) {
        try {
          const parsedNodes = JSON.parse(nodesJson);
          const parsedRootIds = JSON.parse(rootIdsJson);
          set({ nodes: parsedNodes, rootIds: parsedRootIds });
          // 初始化日历节点 ID 映射
          initCalendarNodeIdMap(parsedNodes);
        } catch (e) {
          console.error('[NodeStore] localStorage 解析失败:', e);
        }
      } else if (storedVersion !== CURRENT_DATA_VERSION) {
        // 版本更新后在离线模式仅标记版本，不隐式创建业务数据
        localStorage.setItem(getVersionKey(), CURRENT_DATA_VERSION);
        localStorage.removeItem(sampleDataKey);
      }
    }
  },

  saveToStorage: () => {
    const { nodes, rootIds } = get();
    localStorage.setItem(getNodesKey(), JSON.stringify(nodes));
    localStorage.setItem(getRootIdsKey(), JSON.stringify(rootIds));
  },

  // 从数据库 API 加载节点数据（仅日历/通用树）
  loadFromAPI: async () => {
    try {
      const dbData = await loadNodesFromDB();
      if (dbData && Object.keys(dbData.nodes).length > 0) {
        console.log('[NodeStore] 从数据库加载数据:', { nodesCount: Object.keys(dbData.nodes).length });
        set({ nodes: dbData.nodes, rootIds: dbData.rootIds });

        initCalendarNodeIdMap(dbData.nodes);
        localStorage.setItem(getNodesKey(), JSON.stringify(dbData.nodes));
        localStorage.setItem(getRootIdsKey(), JSON.stringify(dbData.rootIds));
      } else {
        console.log('[NodeStore] 数据库无数据，清空本地节点缓存');
        clearClientCaches({ clearUserIdentity: false, clearQueryCache: true });
        set({ nodes: {}, rootIds: [], hoistedNodeId: null, focusedNodeId: null });
        localStorage.setItem(getVersionKey(), CURRENT_DATA_VERSION);
      }
    } catch (error) {
      console.error('[NodeStore] loadFromAPI 失败:', error);
      throw error;
    }
  },

  getSidebarEntries: () => {
    const { nodes } = get();
    const userRootId = Object.values(nodes).find((n) => n.nodeRole === 'user_root')?.id;
    if (!userRootId) return [];
    // 过滤掉 daily_root，仅返回可导航的笔记本
    return (nodes[userRootId]?.childrenIds ?? []).filter((childId) => {
      const child = nodes[childId];
      return child && child.nodeRole !== 'daily_root';
    });
  },

  isInDailyTree: (nodeId: string) => {
    const { nodes } = get();
    let current: Node | undefined = nodes[nodeId];
    while (current) {
      if (current.nodeRole === 'daily_root') return true;
      current = current.parentId ? nodes[current.parentId] : undefined;
    }
    return false;
  },

  initWithMockData: () => {
    // 初始化空数据
    set({ nodes: {}, rootIds: [] });
    localStorage.setItem(getVersionKey(), CURRENT_DATA_VERSION);
  },

  initWithGuideData: () => {
    set({ nodes: {}, rootIds: [] });
    localStorage.setItem(getVersionKey(), CURRENT_DATA_VERSION);
    console.log('✅ 已初始化数据');
  },

  applySupertag: (nodeId, supertagId, options = {}) => {
    const { fillTemplateIfEmpty = true } = options;
    const state = get();
    const node = state.nodes[nodeId];
    if (!node) return;

    const supertag = useSupertagStore.getState().supertags[supertagId];
    const templateContent = supertag?.templateContent;
    const getFieldDefinitions = useSupertagStore.getState().getFieldDefinitions;
    const defs = getFieldDefinitions(supertagId) ?? [];

    // v4.2: 根据 fieldDefinitions 生成默认 fields（date 默认当天，其余 null/[]）
    const defaultFields: Record<string, unknown> = {};
    const today = new Date().toISOString().slice(0, 10);
    for (const d of defs) {
      if (d.type === 'date') defaultFields[d.key] = today;
      else if (d.type === 'reference' && (d as FieldDefinition).multiple) defaultFields[d.key] = [];
      else if (d.type === 'reference') defaultFields[d.key] = null;
      else defaultFields[d.key] = null;
    }
    const mergedFields = { ...defaultFields, ...node.fields };

    set((s) => {
      const newNodes = {
        ...s.nodes,
        [nodeId]: {
          ...s.nodes[nodeId]!,
          supertagId,
          tags: [...(s.nodes[nodeId]?.tags ?? []).filter((t) => t !== supertagId), supertagId],
          fields: mergedFields,
        },
      };
      debouncedSave(newNodes, s.rootIds);
      return { nodes: newNodes };
    });

    // 同步 supertagId、tags、fields 到数据库
    const updatedNode = get().nodes[nodeId];
    if (updatedNode) {
      queueUpdateNode(nodeId, {
        supertagId: updatedNode.supertagId,
        tags: updatedNode.tags,
        fields: updatedNode.fields,
      });
    }

    if (!fillTemplateIfEmpty || !templateContent || node.childrenIds.length > 0) return;

    const roots: TemplateNode[] = Array.isArray(templateContent) ? templateContent : [templateContent];
    const newNodes: Record<string, Node> = {};
    const rootIds: string[] = [];
    
    // v3.5: 收集需要递归应用嵌套标签的节点
    // 使用队列迭代而非递归，避免深层递归导致栈溢出
    const pendingNestedTags: Array<{ nodeId: string; supertagId: string }> = [];

    function build(template: TemplateNode, parentId: string): string {
      const id = generateId();
      const childTemplates = template.children ?? [];
      const childIds: string[] = [];
      for (const c of childTemplates) {
        childIds.push(build(c, id));
      }
      
      // v3.5: 支持预设字段值
      const presetFields = template.fields ?? {};
      
      const newNode: Node = {
        id,
        content: template.content,
        parentId,
        childrenIds: childIds,
        isCollapsed: false,
        tags: [],
        fields: { ...presetFields },
        createdAt: Date.now(),
        // v3.5: 如果预设子节点有 supertagId，先记录但不立即设置
        // 在创建完所有节点后，通过队列迭代应用嵌套标签
      };
      
      // v3.5: 收集嵌套标签信息
      if (template.supertagId) {
        pendingNestedTags.push({ nodeId: id, supertagId: template.supertagId });
      }
      
      newNodes[id] = newNode;
      return id;
    }

    for (const r of roots) {
      rootIds.push(build(r, nodeId));
    }

    get().addNodes(newNodes, rootIds, nodeId);
    
    // v3.5: 处理嵌套标签应用（队列迭代）
    // 在所有模板节点创建完成后，递归应用嵌套标签
    const processQueue = [...pendingNestedTags];
    const supertagStore = useSupertagStore.getState();
    
    while (processQueue.length > 0) {
      const task = processQueue.shift()!;
      const nestedSupertag = supertagStore.supertags[task.supertagId];
      
      if (!nestedSupertag) {
        console.warn(`[applySupertag] 嵌套标签不存在: ${task.supertagId}`);
        continue;
      }

      const nestedDefs = supertagStore.getFieldDefinitions(task.supertagId) ?? [];
      const nestedDefaults: Record<string, unknown> = {};
      const today = new Date().toISOString().slice(0, 10);
      for (const d of nestedDefs) {
        if (d.type === 'date') nestedDefaults[d.key] = today;
        else if (d.type === 'reference' && (d as FieldDefinition).multiple) nestedDefaults[d.key] = [];
        else if (d.type === 'reference') nestedDefaults[d.key] = null;
        else nestedDefaults[d.key] = null;
      }
      const targetNodeForMerge = get().nodes[task.nodeId];
      const nestedMergedFields = { ...nestedDefaults, ...(targetNodeForMerge?.fields ?? {}) };
      
      // 更新节点的 supertagId、tags 与默认 fields
      set((s) => {
        const targetNode = s.nodes[task.nodeId];
        if (!targetNode) return s;
        
        const newNodes = {
          ...s.nodes,
          [task.nodeId]: {
            ...targetNode,
            supertagId: task.supertagId,
            tags: [...(targetNode.tags ?? []).filter((t) => t !== task.supertagId), task.supertagId],
            fields: nestedMergedFields,
          },
        };
        debouncedSave(newNodes, s.rootIds);
        return { nodes: newNodes };
      });
      
      // 同步到数据库
      const nestedUpdatedNode = get().nodes[task.nodeId];
      if (nestedUpdatedNode) {
        queueUpdateNode(task.nodeId, {
          supertagId: nestedUpdatedNode.supertagId,
          tags: nestedUpdatedNode.tags,
          fields: nestedUpdatedNode.fields,
        });
      }
      
      // 检查嵌套标签是否有自己的模板内容，如果有且节点无子节点则递归创建
      const nestedTemplate = nestedSupertag.templateContent;
      const targetNode = get().nodes[task.nodeId];
      
      if (nestedTemplate && targetNode && targetNode.childrenIds.length === 0) {
        const nestedRoots: TemplateNode[] = Array.isArray(nestedTemplate) ? nestedTemplate : [nestedTemplate];
        const nestedNewNodes: Record<string, Node> = {};
        const nestedRootIds: string[] = [];
        
        // 递归构建嵌套模板节点
        function buildNested(template: TemplateNode, parentId: string): string {
          const id = generateId();
          const childTemplates = template.children ?? [];
          const childIds: string[] = [];
          for (const c of childTemplates) {
            childIds.push(buildNested(c, id));
          }
          
          const newNode: Node = {
            id,
            content: template.content,
            parentId,
            childrenIds: childIds,
            isCollapsed: false,
            tags: [],
            fields: { ...(template.fields ?? {}) },
            createdAt: Date.now(),
          };
          
          // 收集更深层的嵌套标签
          if (template.supertagId) {
            processQueue.push({ nodeId: id, supertagId: template.supertagId });
          }
          
          nestedNewNodes[id] = newNode;
          return id;
        }
        
        for (const r of nestedRoots) {
          nestedRootIds.push(buildNested(r, task.nodeId));
        }
        
        get().addNodes(nestedNewNodes, nestedRootIds, task.nodeId);
      }
    }
  },

  applyDeconstructPreview: (sourceNodeId, nodes) => {
    const state = get();
    const sourceNode = state.nodes[sourceNodeId];
    if (!sourceNode || !nodes.length) return;

    let rootAssigned = false;
    const tempIdToRealId = new Map<string, string>();
    for (const n of nodes) {
      let realId: string;
      if (n.parentTempId === null) {
        if (!rootAssigned) {
          rootAssigned = true;
          realId = sourceNodeId;
        } else {
          realId = get().addNode(sourceNodeId);
        }
      } else {
        realId = get().addNode(tempIdToRealId.get(n.parentTempId)!);
      }
      tempIdToRealId.set(n.tempId, realId);
    }
    for (const n of nodes) {
      const realId = tempIdToRealId.get(n.tempId)!;
      const updates: Partial<Node> = {
        content: n.content,
        fields: n.fields ?? {},
      };
      if (n.supertagId) {
        updates.supertagId = n.supertagId;
        updates.tags = [n.supertagId];
      } else {
        updates.tags = [];
      }
      get().updateNode(realId, updates);
    }
    useDeconstructPreviewStore.getState().setPreview(sourceNodeId, null);
  },
}));

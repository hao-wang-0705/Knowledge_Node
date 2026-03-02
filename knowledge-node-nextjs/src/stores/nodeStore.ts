import { create } from 'zustand';
import { Node, CommandConfig, TemplateNode } from '@/types';
import { generateId, STORAGE_KEYS, CURRENT_DATA_VERSION, debounce } from '@/utils/helpers';
import { getTemplateById } from '@/utils/command-templates';
import { getCalendarPath, SYSTEM_TAGS, getCalendarNodeType } from '@/utils/date-helpers';
import {
  findCalendarNodeActualId,
  resolveCalendarParentId,
  initCalendarNodeIdMap,
  setCalendarNodeIdMapping,
} from '@/utils/calendarNodeId';
import { getUserStorageKey, migrateOldData } from '@/utils/userStorage';
import { clearClientCaches } from '@/utils/cache';
import { useSupertagStore } from '@/stores/supertagStore';
import { useSyncStore } from '@/stores/syncStore';

// 样例数据初始化 key（内联定义，替代原 sampleData.ts）
const SAMPLE_DATA_INITIALIZED_KEY = 'knowledge-node-sample-initialized';

export const ROOT_NODE_ID = 'root';

interface NodeStoreState {
  nodes: Record<string, Node>;
  rootIds: string[];
  focusedNodeId: string | null;
  hoistedNodeId: string | null;
}

interface NodeStoreActions {
  addNode: (parentId: string | null, afterId?: string) => string;
  addNodes: (newNodes: Record<string, Node>, newRootIds: string[], targetParentId: string | null, afterId?: string) => void;
  addCommandNode: (parentId: string | null, templateId?: string, prompt?: string, afterId?: string) => string;
  addAIResponseNode: (commandNodeId: string, content: string) => string;
  executeCommandNode: (commandNodeId: string) => Promise<void>;
  updateNode: (id: string, updates: Partial<Node>) => void;
  deleteNode: (id: string) => void;
  indentNode: (id: string) => void;
  outdentNode: (id: string) => void;
  toggleCollapse: (id: string) => void;
  setFocusedNode: (id: string | null) => void;
  setHoistedNode: (id: string | null) => void;
  ensureNode: (id: string, parentId: string | null, tagId: string | null, content: string) => string;
  ensureTodayNode: () => string;
  goToToday: () => void;
  goToRoot: () => void;
  getNodePath: (nodeId: string) => Node[];
  loadFromStorage: () => void | Promise<void>;
  loadFromAPI: () => Promise<void>;
  mergeNotebookTree: (notebookId: string) => Promise<void>;
  saveToStorage: () => void;
  initWithMockData: () => void;
  initWithGuideData: () => void;
  /** v2.1: 应用 Supertag 到节点，可选自动填充默认内容模版 */
  applySupertag: (nodeId: string, supertagId: string, options?: { fillTemplateIfEmpty?: boolean }) => void;
}

type NodeStore = NodeStoreState & NodeStoreActions;

// 获取用户专属的存储 key
const getNodesKey = () => getUserStorageKey(STORAGE_KEYS.NODES);
const getRootIdsKey = () => getUserStorageKey(STORAGE_KEYS.ROOT_IDS);
const getVersionKey = () => getUserStorageKey(STORAGE_KEYS.DATA_VERSION);

const debouncedSave = debounce((nodes: Record<string, Node>, rootIds: string[]) => {
  localStorage.setItem(getNodesKey(), JSON.stringify(nodes));
  localStorage.setItem(getRootIdsKey(), JSON.stringify(rootIds));
}, 500);

// ============ 数据库同步 API（通过 SyncStore 队列） ============

/**
 * 将节点创建操作加入同步队列
 */
const queueCreateNode = (node: Node, sortOrder: number = 0) => {
  const syncStore = useSyncStore.getState();
  
  // 检查网络状态，如果在线则直接入队
  syncStore.queueOperation({
    type: 'create',
    entityType: 'node',
    entityId: node.id,
    payload: {
      id: node.id,
      content: node.content,
      parentId: node.parentId,
      nodeType: node.type || 'text',
      supertagId: node.supertagId,
      scope: node.scope,
      notebookId: node.notebookId,
      fields: node.fields,
      payload: node.payload,
      sortOrder,
    },
  });
};

/**
 * 更新节点到数据库（通过同步队列，内置合并逻辑）
 */
const queueUpdateNode = (nodeId: string, updates: Partial<Node> & { sortOrder?: number }) => {
  const syncStore = useSyncStore.getState();
  
  syncStore.queueOperation({
    type: 'update',
    entityType: 'node',
    entityId: nodeId,
    payload: {
      content: updates.content,
      parentId: updates.parentId,
      nodeType: updates.type,
      supertagId: updates.supertagId,
      scope: updates.scope,
      notebookId: updates.notebookId,
      fields: updates.fields,
      payload: updates.payload,
      isCollapsed: updates.isCollapsed,
    },
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

const resolveNodeScope = (
  parentId: string | null,
  nodes: Record<string, Node>,
  options?: { forceDaily?: boolean }
): { scope: Node['scope']; notebookId: Node['notebookId'] } => {
  if (options?.forceDaily) return { scope: 'daily', notebookId: null };
  if (!parentId) return { scope: 'general', notebookId: null };
  const parent = nodes[parentId];
  if (!parent) return { scope: 'general', notebookId: null };
  return {
    scope: parent.scope ?? 'general',
    notebookId: parent.scope === 'notebook' ? (parent.notebookId ?? null) : null,
  };
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

/** 从数据库加载节点（ADR-005：默认仅拉取日历/通用树，后端已按 scope 排除 notebook） */
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

    for (const node of data.data) {
      nodes[node.id] = {
        id: node.id,
        content: node.content,
        type: node.type,
        parentId: node.parentId,
        childrenIds: node.childrenIds || [],
        isCollapsed: node.isCollapsed,
        tags: node.tags || [],
        supertagId: node.supertagId,
        scope: node.scope,
        notebookId: node.notebookId,
        fields: node.fields || {},
        payload: node.payload,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      };

      if (!node.parentId) {
        rootIds.push(node.id);
      }
    }

    return { nodes, rootIds };
  } catch (error) {
    console.error('[loadNodesFromDB] Error:', error);
    return null;
  }
};

/** 加载指定笔记本树并合并到 store（ADR-005） */
const loadNotebookTreeFromDB = async (
  notebookId: string
): Promise<{ nodes: Record<string, Node>; rootId: string | null } | null> => {
  try {
    const res = await fetch(`/api/nodes?scope=notebook&notebookId=${encodeURIComponent(notebookId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success || !Array.isArray(data.data)) return null;

    const nodes: Record<string, Node> = {};
    let rootId: string | null = null;

    for (const node of data.data) {
      nodes[node.id] = {
        id: node.id,
        content: node.content,
        type: node.type,
        parentId: node.parentId,
        childrenIds: node.childrenIds || [],
        isCollapsed: node.isCollapsed,
        tags: node.tags || [],
        supertagId: node.supertagId,
        scope: node.scope,
        notebookId: node.notebookId,
        fields: node.fields || {},
        payload: node.payload,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      };
      if (!node.parentId) rootId = node.id;
    }

    return { nodes, rootId };
  } catch (error) {
    console.error('[loadNotebookTreeFromDB] Error:', error);
    return null;
  }
};

// ============ Store ============

export const useNodeStore = create<NodeStore>((set, get) => ({
  nodes: {},
  rootIds: [],
  focusedNodeId: null,
  hoistedNodeId: null,

  addNode: (parentId, afterId) => {
    const newId = generateId();
    
    // 使用一个变量来存储实际创建的节点和父节点 ID
    let createdNode: Node | null = null;
    let resolvedParentId: string | null = null;

    set((state) => {
      // 在 set 回调内部解析父节点的实际 ID，确保使用最新的状态
      resolvedParentId = resolveCalendarParentId(parentId, state.nodes);
      
      const newNode: Node = {
        id: newId,
        content: '',
        parentId: resolvedParentId,
        childrenIds: [],
        isCollapsed: false,
        ...resolveNodeScope(resolvedParentId, state.nodes),
        tags: [],
        fields: {},
        createdAt: Date.now(),
      };
      
      // 保存创建的节点供后续同步使用
      createdNode = newNode;

      const newNodes = { ...state.nodes, [newId]: newNode };
      let newRootIds = [...state.rootIds];

      if (resolvedParentId === null) {
        if (afterId) {
          const afterIndex = newRootIds.indexOf(afterId);
          newRootIds.splice(afterIndex !== -1 ? afterIndex + 1 : newRootIds.length, 0, newId);
        } else {
          newRootIds.push(newId);
        }
      } else {
        const parentNode = newNodes[resolvedParentId];
        if (parentNode) {
          const newChildrenIds = [...parentNode.childrenIds];
          
          // 检查父节点是否为日历节点（年/月/周）- 需要检查原始 ID 或带前缀的 ID
          const isCalendarParent = resolvedParentId.includes('year-') || 
            resolvedParentId.includes('month-') || 
            resolvedParentId.includes('week-');
          
          if (afterId) {
            // 解析 afterId（可能也是日历节点）
            const actualAfterId = resolveCalendarParentId(afterId, state.nodes) || afterId;
            const afterIndex = newChildrenIds.indexOf(actualAfterId);
            newChildrenIds.splice(afterIndex !== -1 ? afterIndex + 1 : newChildrenIds.length, 0, newId);
          } else if (isCalendarParent) {
            // 在日历层级（年/月/周）下添加笔记时，将新节点放到所有日历子节点之后
            // 找到最后一个日历子节点的位置
            let lastCalendarChildIndex = -1;
            for (let i = 0; i < newChildrenIds.length; i++) {
              const childId = newChildrenIds[i];
              // 检查子节点是否为日历节点（包括带前缀的）
              const isCalendarChild = childId.includes('year-') || 
                childId.includes('month-') || 
                childId.includes('week-') || 
                childId.includes('day-');
              if (isCalendarChild) {
                lastCalendarChildIndex = i;
              }
            }
            // 将新节点插入到日历子节点之后
            newChildrenIds.splice(lastCalendarChildIndex + 1, 0, newId);
          } else {
            newChildrenIds.push(newId);
          }
          newNodes[resolvedParentId] = { ...parentNode, childrenIds: newChildrenIds };
        } else {
          // 父节点不存在（可能是竞态条件），降级为根节点
          console.warn(`[addNode] 父节点 ${resolvedParentId} 不存在，降级为根节点`);
          resolvedParentId = null;
          createdNode = { ...newNode, parentId: null };
          newNodes[newId] = createdNode;
          newRootIds.push(newId);
        }
      }

      debouncedSave(newNodes, newRootIds);
      return { nodes: newNodes, rootIds: newRootIds, focusedNodeId: newId };
    });

    // 异步同步到数据库（通过同步队列）
    // 使用 set 回调内部计算的实际值
    if (createdNode) {
      const updatedState = get();
      const sortOrder = resolvedParentId 
        ? updatedState.nodes[resolvedParentId]?.childrenIds.indexOf(newId) ?? 0
        : updatedState.rootIds.indexOf(newId);
      queueCreateNode(createdNode, sortOrder);
      queueSortOrderSyncForParent(
        resolvedParentId,
        updatedState.nodes,
        updatedState.rootIds,
        new Set([newId])
      );
    }

    return newId;
  },

  addNodes: (newNodes, newRootIds, targetParentId, afterId) => {
    set((state) => {
      const mergedNodes = { ...state.nodes, ...newNodes };
      let mergedRootIds = [...state.rootIds];

      if (targetParentId === null) {
        if (afterId) {
          const afterIndex = mergedRootIds.indexOf(afterId);
          mergedRootIds.splice(afterIndex !== -1 ? afterIndex + 1 : mergedRootIds.length, 0, ...newRootIds);
        } else {
          mergedRootIds = [...mergedRootIds, ...newRootIds];
        }
      } else {
        const parentNode = mergedNodes[targetParentId];
        if (parentNode) {
          for (const rootId of newRootIds) {
            if (mergedNodes[rootId]) {
              mergedNodes[rootId] = { ...mergedNodes[rootId], parentId: targetParentId };
            }
          }
          let newChildrenIds = [...parentNode.childrenIds];
          if (afterId) {
            const afterIndex = newChildrenIds.indexOf(afterId);
            newChildrenIds.splice(afterIndex !== -1 ? afterIndex + 1 : newChildrenIds.length, 0, ...newRootIds);
          } else {
            newChildrenIds = [...newChildrenIds, ...newRootIds];
          }
          mergedNodes[targetParentId] = { ...parentNode, childrenIds: newChildrenIds };
        }
      }

      debouncedSave(mergedNodes, mergedRootIds);
      return { nodes: mergedNodes, rootIds: mergedRootIds };
    });
  },

  // 添加指令节点
  addCommandNode: (parentId, templateId, prompt, afterId) => {
    const newId = generateId();
    
    // 获取模板信息
    const template = templateId ? getTemplateById(templateId) : undefined;
    const commandName = template ? template.name : '自定义指令';
    const commandPrompt = prompt || template?.prompt || '';
    
    // 创建指令配置
    const commandConfig: CommandConfig = {
      templateId,
      prompt: commandPrompt,
      model: 'gpt-4',
      lastExecutionStatus: 'pending',
    };
    
    const newNode: Node = {
      id: newId,
      content: template ? `🤖 ${template.icon} ${commandName}` : `🤖 ${commandName}`,
      type: 'command',
      parentId,
      childrenIds: [],
      isCollapsed: false,
      tags: [],
      fields: {},
      createdAt: Date.now(),
      payload: commandConfig,
    };

    set((state) => {
      const newNodes = { ...state.nodes, [newId]: newNode };
      let newRootIds = [...state.rootIds];

      if (parentId === null) {
        if (afterId) {
          const afterIndex = newRootIds.indexOf(afterId);
          newRootIds.splice(afterIndex !== -1 ? afterIndex + 1 : newRootIds.length, 0, newId);
        } else {
          newRootIds.push(newId);
        }
      } else {
        const parentNode = newNodes[parentId];
        if (parentNode) {
          const newChildrenIds = [...parentNode.childrenIds];
          if (afterId) {
            const afterIndex = newChildrenIds.indexOf(afterId);
            newChildrenIds.splice(afterIndex !== -1 ? afterIndex + 1 : newChildrenIds.length, 0, newId);
          } else {
            newChildrenIds.push(newId);
          }
          newNodes[parentId] = { ...parentNode, childrenIds: newChildrenIds };
        }
      }

      debouncedSave(newNodes, newRootIds);
      return { nodes: newNodes, rootIds: newRootIds, focusedNodeId: newId };
    });

    return newId;
  },

  // 添加AI响应子节点（AI生成的内容作为子节点）
  addAIResponseNode: (commandNodeId, content) => {
    const newId = generateId();
    
    const newNode: Node = {
      id: newId,
      content,
      type: 'text', // AI 生成的内容是普通文本节点，可以编辑
      parentId: commandNodeId,
      childrenIds: [],
      isCollapsed: false,
      tags: [],
      fields: {},
      createdAt: Date.now(),
    };

    set((state) => {
      const commandNode = state.nodes[commandNodeId];
      if (!commandNode) return state;
      
      const newNodes = { ...state.nodes, [newId]: newNode };
      
      // 将新节点添加到指令节点的子节点列表
      newNodes[commandNodeId] = {
        ...commandNode,
        childrenIds: [...commandNode.childrenIds, newId],
        isCollapsed: false, // 展开以显示新生成的内容
      };

      debouncedSave(newNodes, state.rootIds);
      return { nodes: newNodes };
    });

    return newId;
  },

  // 执行指令节点 - 调用真实 AI 服务
  executeCommandNode: async (commandNodeId) => {
    const state = get();
    const commandNode = state.nodes[commandNodeId];
    
    if (!commandNode || commandNode.type !== 'command') {
      const error = new Error('无效的指令节点');
      console.error('[executeCommandNode] Invalid command node:', commandNodeId);
      throw error;
    }

    const commandConfig = commandNode.payload as CommandConfig;
    
    // 验证 prompt 不为空
    if (!commandConfig.prompt && !commandConfig.templateId) {
      const error = new Error('指令内容不能为空，请先配置 Prompt 或选择模板');
      console.error('[executeCommandNode] Missing prompt:', commandNodeId);
      throw error;
    }
    
    // 更新执行状态为进行中
    set((s) => ({
      nodes: {
        ...s.nodes,
        [commandNodeId]: {
          ...s.nodes[commandNodeId],
          payload: {
            ...commandConfig,
            lastExecutionStatus: 'pending' as const,
            lastExecutedAt: Date.now(),
          },
        },
      },
    }));

    try {
      // 收集上下文（当前节点的兄弟节点内容）
      let context = '';
      if (commandNode.parentId) {
        const parentNode = state.nodes[commandNode.parentId];
        if (parentNode) {
          // 获取同级节点内容作为上下文
          const siblingContents = parentNode.childrenIds
            .map(id => state.nodes[id])
            .filter(n => n && n.id !== commandNodeId && n.type !== 'command')
            .map(n => n.content)
            .filter(c => c && c.trim())
            .join('\n\n');
          context = siblingContents;
        }
      }

      // 调用 AI API
      const response = await fetch('/api/ai/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commandId: commandNodeId,
          templateId: commandConfig.templateId,
          prompt: commandConfig.prompt,
          context,
          model: commandConfig.model,
          maxTokens: commandConfig.maxTokens,
          stream: false, // 非流式，简化处理
        }),
      });

      const result = await response.json();

      // 检查 API 响应
      if (!response.ok || !result.success) {
        const errorMessage = result.error?.message || `AI 服务请求失败 (${response.status})`;
        const suggestion = result.error?.suggestion || '';
        const fullError = suggestion ? `${errorMessage}\n${suggestion}` : errorMessage;
        throw new Error(fullError);
      }

      // 检查响应内容
      const content = result.data?.content;
      if (!content || content.trim().length === 0) {
        throw new Error('AI 返回了空响应，请调整指令内容后重试');
      }

      // 将 AI 响应按段落拆分为多个子节点
      const paragraphs = content
        .split(/\n{2,}/)
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 0);
      
      // 添加 AI 响应作为子节点
      for (const paragraph of paragraphs) {
        get().addAIResponseNode(commandNodeId, paragraph);
      }
      
      // 更新执行状态为成功
      set((s) => {
        const node = s.nodes[commandNodeId];
        if (!node) return s;
        
        return {
          nodes: {
            ...s.nodes,
            [commandNodeId]: {
              ...node,
              payload: {
                ...(node.payload as CommandConfig),
                lastExecutionStatus: 'success' as const,
                lastExecutedAt: Date.now(),
              },
            },
          },
        };
      });
      
      // 保存到 storage
      const newState = get();
      debouncedSave(newState.nodes, newState.rootIds);
      
    } catch (error) {
      console.error('[executeCommandNode] Execution failed:', error);
      
      // 更新执行状态为失败，并保存错误信息
      set((s) => {
        const node = s.nodes[commandNodeId];
        if (!node) return s;
        
        const errorMessage = error instanceof Error ? error.message : '执行失败';
        
        return {
          nodes: {
            ...s.nodes,
            [commandNodeId]: {
              ...node,
              payload: {
                ...(node.payload as CommandConfig),
                lastExecutionStatus: 'error' as const,
                lastExecutedAt: Date.now(),
                lastError: errorMessage,
              },
            },
          },
        };
      });
      
      // 重新抛出错误，让调用方处理
      throw error;
    }
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

      let newRootIds = state.rootIds.filter((rootId) => !nodesToDelete.has(rootId));

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

  toggleCollapse: (id) => {
    set((state) => {
      const targetNode = state.nodes[id];
      if (!targetNode) return state;
      const newNodes = { ...state.nodes, [id]: { ...targetNode, isCollapsed: !targetNode.isCollapsed } };
      debouncedSave(newNodes, state.rootIds);
      return { nodes: newNodes };
    });
  },

  setFocusedNode: (id) => set({ focusedNodeId: id }),

  setHoistedNode: (id) => set({ hoistedNodeId: id, focusedNodeId: id }),

  /**
   * 确保节点存在（如果不存在则创建）
   * 对于日历节点，会检查是否已存在带前缀的版本
   */
  ensureNode: (id, parentId, tagId, content) => {
    // 检查是否是日历节点
    const isCalendarNode = getCalendarNodeType(id) !== null;
    
    // 用于存储创建的节点（如果需要同步到数据库）
    let nodeToSync: Node | null = null;
    let actualParentIdForSync: string | null = null;
    let wasCreated = false;
    
    // 使用原子操作检查并创建节点
    set((currentState) => {
      // 在 set 回调内部检查节点是否存在，确保使用最新状态
      if (isCalendarNode) {
        // 对于日历节点，先检查是否已存在（包括带前缀的版本）
        const actualId = findCalendarNodeActualId(id, currentState.nodes);
        if (actualId) {
          console.log(`[ensureNode] 日历节点 ${id} 已存在，实际 ID: ${actualId}`);
          setCalendarNodeIdMapping(id, actualId);
          return currentState; // 不需要创建
        }
      } else {
        // 非日历节点，直接检查是否存在
        if (currentState.nodes[id]) {
          return currentState; // 不需要创建
        }
      }
      
      // 节点不存在，需要创建
      // 解析父节点的实际 ID（在当前状态下）
      actualParentIdForSync = resolveCalendarParentId(parentId, currentState.nodes);

      const newNode: Node = {
        id,
        content,
        parentId: actualParentIdForSync,
        childrenIds: [],
        isCollapsed: false,
        ...resolveNodeScope(actualParentIdForSync, currentState.nodes, { forceDaily: isCalendarNode }),
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
      } else {
        const parentNode = newNodes[actualParentIdForSync];
        if (parentNode && !parentNode.childrenIds.includes(id)) {
          newNodes[actualParentIdForSync] = { ...parentNode, childrenIds: [...parentNode.childrenIds, id] };
        }
      }
      
      if (isCalendarNode) {
        setCalendarNodeIdMapping(id, id);
      }

      debouncedSave(newNodes, newRootIds);
      return { nodes: newNodes, rootIds: newRootIds };
    });
    
    // 如果创建了新节点，同步到数据库
    if (wasCreated && nodeToSync) {
      const updatedState = get();
      const sortOrder = actualParentIdForSync 
        ? updatedState.nodes[actualParentIdForSync]?.childrenIds.indexOf(id) ?? 0
        : updatedState.rootIds.indexOf(id);
      queueCreateNode(nodeToSync, sortOrder);
    }

    return id;
  },

  goToToday: () => {
    const { ensureTodayNode, setHoistedNode } = get();
    const state = get();
    const calendarPath = getCalendarPath(new Date());
    
    // 先尝试查找已存在的日期节点（可能带前缀）
    const existingDayId = findCalendarNodeActualId(calendarPath.dayId, state.nodes);
    
    if (existingDayId) {
      console.log('[goToToday] 找到已存在的日期节点:', existingDayId);
      setHoistedNode(existingDayId);
    } else {
      // 节点不存在，创建它
      const dayId = ensureTodayNode();
      setHoistedNode(dayId);
    }
  },

  /**
   * 确保今天的日历节点存在（年→月→周→日）
   * 用于应用启动时自动创建当天日记
   * 返回实际的日期节点 ID（可能带前缀）
   */
  ensureTodayNode: () => {
    const { ensureNode } = get();
    const calendarPath = getCalendarPath(new Date());

    // 依次确保年、月、周、日节点存在
    // 每一步都需要获取实际的 ID（可能带前缀），并用实际 ID 作为下一层的 parentId
    const actualYearId = ensureNode(calendarPath.yearId, null, SYSTEM_TAGS.YEAR, calendarPath.yearContent);
    // 获取年节点的实际 ID（可能被修改为带前缀）
    const resolvedYearId = findCalendarNodeActualId(calendarPath.yearId, get().nodes) || actualYearId;
    
    const actualMonthId = ensureNode(calendarPath.monthId, resolvedYearId, SYSTEM_TAGS.MONTH, calendarPath.monthContent);
    // 获取月节点的实际 ID
    const resolvedMonthId = findCalendarNodeActualId(calendarPath.monthId, get().nodes) || actualMonthId;
    
    const actualWeekId = ensureNode(calendarPath.weekId, resolvedMonthId, SYSTEM_TAGS.WEEK, calendarPath.weekContent);
    // 获取周节点的实际 ID
    const resolvedWeekId = findCalendarNodeActualId(calendarPath.weekId, get().nodes) || actualWeekId;
    
    const actualDayId = ensureNode(calendarPath.dayId, resolvedWeekId, SYSTEM_TAGS.DAY, calendarPath.dayContent);

    console.log('[ensureTodayNode] 日历节点已确保:', {
      year: actualYearId,
      month: actualMonthId,
      week: actualWeekId,
      day: actualDayId,
    });

    // 返回实际的日期节点 ID
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
          } else {
            console.log('[NodeStore] 数据库无数据，清空本地缓存以保持一致');
            clearClientCaches({ clearUserIdentity: false, clearQueryCache: true });
            syncStore.clearQueue();
            set({ nodes: {}, rootIds: [], hoistedNodeId: null, focusedNodeId: null });
            localStorage.setItem(getVersionKey(), CURRENT_DATA_VERSION);
            localStorage.removeItem(sampleDataKey);
            syncStore.setStatus('synced');
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

  /** ADR-005: 加载并合并指定笔记本树到当前 nodes，便于笔记本视图展示 */
  mergeNotebookTree: async (notebookId: string) => {
    const data = await loadNotebookTreeFromDB(notebookId);
    if (!data || !data.rootId) return;
    set((state) => ({
      nodes: { ...state.nodes, ...data.nodes },
    }));
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

    set((s) => {
      const newNodes = { ...s.nodes, [nodeId]: { ...s.nodes[nodeId]!, supertagId, tags: [...(s.nodes[nodeId]?.tags ?? []).filter((t) => t !== supertagId), supertagId] } };
      debouncedSave(newNodes, s.rootIds);
      return { nodes: newNodes };
    });

    if (!fillTemplateIfEmpty || !templateContent || node.childrenIds.length > 0) return;

    const roots: TemplateNode[] = Array.isArray(templateContent) ? templateContent : [templateContent];
    const newNodes: Record<string, Node> = {};
    const rootIds: string[] = [];

    function build(template: TemplateNode, parentId: string): string {
      const id = generateId();
      const childTemplates = template.children ?? [];
      const childIds: string[] = [];
      for (const c of childTemplates) {
        childIds.push(build(c, id));
      }
      const newNode: Node = {
        id,
        content: template.content,
        parentId,
        childrenIds: childIds,
        isCollapsed: false,
        tags: [],
        fields: {},
        createdAt: Date.now(),
      };
      newNodes[id] = newNode;
      return id;
    }

    for (const r of roots) {
      rootIds.push(build(r, nodeId));
    }

    get().addNodes(newNodes, rootIds, nodeId);
  },
}));

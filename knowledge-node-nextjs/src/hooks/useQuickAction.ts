'use client';

import { useState, useCallback, useRef } from 'react';
import { useNodeStore } from '@/stores/nodeStore';
import type { Node } from '@/types';
import type { 
  QuickActionType, 
  QuickActionEvent,
  QuickActionNodeEvent,
  QuickActionReplaceEvent,
  QuickActionContext,
} from '@/types/quick-action';

/**
 * 快捷动作执行状态
 */
interface QuickActionExecutionState {
  /** 是否正在执行 */
  isExecuting: boolean;
  /** 当前执行的动作类型 */
  actionType: QuickActionType | null;
  /** 已生成的节点数量 */
  generatedNodeCount: number;
  /** 替换内容（仅 inline_rewrite） */
  replacedContent: string;
  /** 错误信息 */
  error: string | null;
}

/**
 * 快捷动作执行结果
 */
interface QuickActionResult {
  success: boolean;
  nodeCount: number;
  error?: string;
}

/**
 * v4.1: 快捷动作 Hook
 * 提供节点级快捷 AI 动作的执行能力
 */
export function useQuickAction(nodeId: string) {
  const node = useNodeStore((s) => s.nodes[nodeId]);
  const updateNode = useNodeStore((s) => s.updateNode);
  const addNode = useNodeStore((s) => s.addNode);

  const [state, setState] = useState<QuickActionExecutionState>({
    isExecuting: false,
    actionType: null,
    generatedNodeCount: 0,
    replacedContent: '',
    error: null,
  });

  // AbortController 引用
  const abortControllerRef = useRef<AbortController | null>(null);
  // tempId 到 realId 的映射
  const tempIdMapRef = useRef<Map<string, string>>(new Map());

  /**
   * 收集节点上下文
   * v4.1.1: 简化上下文收集，只保留当前节点内容，避免混入其他节点
   */
  const collectContext = useCallback((): QuickActionContext => {
    if (!node) {
      return { nodeContent: '' };
    }

    // 只收集当前节点内容，不再收集兄弟和祖先节点
    return {
      nodeContent: node.content || '',
    };
  }, [node]);

  /**
   * 处理节点创建事件
   */
  const handleNodeEvent = useCallback((event: QuickActionNodeEvent['data']) => {
    const { tempId, parentTempId, content, nodeType, supertagId, fields } = event;

    // 确定父节点 ID
    let realParentId = nodeId; // 默认作为目标节点的子节点
    if (parentTempId) {
      realParentId = tempIdMapRef.current.get(parentTempId) || nodeId;
    }

    // 创建新节点
    const newNodeId = addNode(realParentId);
    
    // 更新节点属性
    const updates: Partial<Node> = {
      content,
      type: nodeType,
    };
    
    if (supertagId) {
      updates.supertagId = supertagId;
    }
    
    if (fields && Object.keys(fields).length > 0) {
      updates.fields = fields as Record<string, unknown>;
    }
    
    updateNode(newNodeId, updates);

    // 记录 tempId 映射
    tempIdMapRef.current.set(tempId, newNodeId);

    // 更新状态
    setState((prev) => ({
      ...prev,
      generatedNodeCount: prev.generatedNodeCount + 1,
    }));
  }, [nodeId, addNode, updateNode]);

  /**
   * 处理内容替换事件
   */
  const handleReplaceEvent = useCallback((event: QuickActionReplaceEvent['data']) => {
    const { content, isFinal } = event;

    if (isFinal) {
      // 最终内容，更新节点
      updateNode(nodeId, { content });
    }

    // 更新状态
    setState((prev) => ({
      ...prev,
      replacedContent: isFinal ? content : prev.replacedContent + content,
    }));
  }, [nodeId, updateNode]);

  /**
   * 执行快捷动作
   */
  const executeAction = useCallback(async (
    actionType: QuickActionType
  ): Promise<QuickActionResult> => {
    if (!node || state.isExecuting) {
      return { success: false, nodeCount: 0, error: '节点不存在或正在执行中' };
    }

    // 重置状态
    setState({
      isExecuting: true,
      actionType,
      generatedNodeCount: 0,
      replacedContent: '',
      error: null,
    });
    tempIdMapRef.current.clear();

    // 创建 AbortController
    abortControllerRef.current = new AbortController();

    try {
      // 收集上下文
      const context = collectContext();

      // 调用 API
      const response = await fetch('/api/ai/quick-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          actionType,
          context,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `请求失败 (${response.status})`);
      }

      // 处理 SSE 流
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let nodeCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const eventData: QuickActionEvent = JSON.parse(line.slice(6));
            const { event, data } = eventData;

            switch (event) {
              case 'node':
                handleNodeEvent(data as QuickActionNodeEvent['data']);
                nodeCount++;
                break;

              case 'replace':
                handleReplaceEvent(data as QuickActionReplaceEvent['data']);
                if ((data as QuickActionReplaceEvent['data']).isFinal) {
                  nodeCount = 1;
                }
                break;

              case 'done':
                console.log('[useQuickAction] Done:', data);
                break;

              case 'error':
                const errorData = data as { code: string; message: string };
                throw new Error(errorData.message || '执行失败');
            }
          } catch (parseError) {
            if (parseError instanceof Error && parseError.message !== '执行失败') {
              console.warn('[useQuickAction] Failed to parse SSE event:', line);
            } else {
              throw parseError;
            }
          }
        }
      }

      // 执行成功
      setState((prev) => ({
        ...prev,
        isExecuting: false,
        actionType: null,
      }));

      return { success: true, nodeCount };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      // 检查是否为取消操作
      if (error instanceof Error && error.name === 'AbortError') {
        setState((prev) => ({
          ...prev,
          isExecuting: false,
          actionType: null,
          error: '操作已取消',
        }));
        return { success: false, nodeCount: 0, error: '操作已取消' };
      }

      setState((prev) => ({
        ...prev,
        isExecuting: false,
        actionType: null,
        error: errorMessage,
      }));

      return { success: false, nodeCount: 0, error: errorMessage };
    } finally {
      abortControllerRef.current = null;
    }
  }, [node, state.isExecuting, nodeId, collectContext, handleNodeEvent, handleReplaceEvent]);

  /**
   * 取消执行
   */
  const cancelAction = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  /**
   * 便捷方法：提取为待办
   */
  const extractTasks = useCallback(() => executeAction('extract_tasks'), [executeAction]);

  /**
   * 便捷方法：结构化提炼
   */
  const structuredSummary = useCallback(() => executeAction('structured_summary'), [executeAction]);

  /**
   * 便捷方法：原地重写
   */
  const inlineRewrite = useCallback(() => executeAction('inline_rewrite'), [executeAction]);

  return {
    // 状态
    isExecuting: state.isExecuting,
    actionType: state.actionType,
    generatedNodeCount: state.generatedNodeCount,
    replacedContent: state.replacedContent,
    error: state.error,
    
    // 方法
    executeAction,
    cancelAction,
    
    // 便捷方法
    extractTasks,
    structuredSummary,
    inlineRewrite,
  };
}

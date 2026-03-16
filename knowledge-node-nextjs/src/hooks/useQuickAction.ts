'use client';

import { useState, useCallback, useRef } from 'react';
import { useNodeStore } from '@/stores/nodeStore';
import { useSupertagStore } from '@/stores/supertagStore';
import { useDeconstructPreviewStore } from '@/stores/deconstructPreviewStore';
import { useExpandPreviewStore } from '@/stores/expandPreviewStore';
import type { Node } from '@/types';
import type {
  QuickActionType,
  QuickActionEvent,
  QuickActionNodeEvent,
  QuickActionReplaceEvent,
  QuickActionContext,
} from '@/types/quick-action';

interface QuickActionExecutionState {
  isExecuting: boolean;
  actionType: QuickActionType | null;
  generatedNodeCount: number;
  replacedContent: string;
  /** 智能扩写流式内容，用于幽灵区实时展示 */
  expandedContent: string;
  error: string | null;
}

interface QuickActionResult {
  success: boolean;
  nodeCount: number;
  error?: string;
}

/**
 * 快捷动作 Hook：仅支持智能扩写(expand)与智能解构(deconstruct)
 */
export function useQuickAction(nodeId: string) {
  const node = useNodeStore((s) => s.nodes[nodeId]);
  const updateNode = useNodeStore((s) => s.updateNode);
  const addNode = useNodeStore((s) => s.addNode);

  const supertags = useSupertagStore((s) => s.supertags);
  const getFieldDefinitions = useSupertagStore((s) => s.getFieldDefinitions);
  const setPreview = useDeconstructPreviewStore((s) => s.setPreview);
  const setExpandPreview = useExpandPreviewStore((s) => s.setPreview);

  const [state, setState] = useState<QuickActionExecutionState>({
    isExecuting: false,
    actionType: null,
    generatedNodeCount: 0,
    replacedContent: '',
    expandedContent: '',
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const tempIdMapRef = useRef<Map<string, string>>(new Map());
  const streamedContentRef = useRef<string>('');

  const collectContext = useCallback((): QuickActionContext => {
    if (!node) return { nodeContent: '' };
    return { nodeContent: node.content || '' };
  }, [node]);

  const handleNodeEvent = useCallback((event: QuickActionNodeEvent['data']) => {
    const { tempId, parentTempId, content, nodeType, supertagId, fields } = event;
    let realParentId = nodeId;
    if (parentTempId) {
      realParentId = tempIdMapRef.current.get(parentTempId) || nodeId;
    }
    const newNodeId = addNode(realParentId);
    const updates: Partial<Node> = { content, type: nodeType };
    if (supertagId) updates.supertagId = supertagId;
    if (fields && Object.keys(fields).length > 0) updates.fields = fields as Record<string, unknown>;
    updateNode(newNodeId, updates);
    tempIdMapRef.current.set(tempId, newNodeId);
    setState((prev) => ({ ...prev, generatedNodeCount: prev.generatedNodeCount + 1 }));
  }, [nodeId, addNode, updateNode]);

  const handleReplaceEvent = useCallback((event: QuickActionReplaceEvent['data']) => {
    const { content, isFinal } = event;
    if (isFinal) updateNode(nodeId, { content });
    setState((prev) => ({ ...prev, replacedContent: isFinal ? content : prev.replacedContent + content }));
  }, [nodeId, updateNode]);

  const executeAction = useCallback(async (actionType: QuickActionType): Promise<QuickActionResult> => {
    if (!node || state.isExecuting) {
      return { success: false, nodeCount: 0, error: '节点不存在或正在执行中' };
    }

    setState({
      isExecuting: true,
      actionType,
      generatedNodeCount: 0,
      replacedContent: '',
      expandedContent: '',
      error: null,
    });
    tempIdMapRef.current.clear();
    streamedContentRef.current = '';
    abortControllerRef.current = new AbortController();

    const context = collectContext();

    let params: Record<string, unknown> = {};
    if (actionType === 'deconstruct') {
      const supertagSchemas = Object.values(supertags)
        .filter((t) => (t as { status?: string }).status !== 'deprecated')
        .map((t) => ({
          id: t.id,
          name: t.name,
          icon: t.icon,
          description: t.description,
          fields: getFieldDefinitions(t.id).map((f) => ({
            key: f.key,
            name: f.name,
            type: f.type,
            options: f.options,
          })),
        }));
      params = { supertags: supertagSchemas };
    }

    try {
      const response = await fetch('/api/ai/quick-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          actionType,
          context,
          params,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `请求失败 (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

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
            const eventData = JSON.parse(line.slice(6)) as { event: string; data: unknown };
            const { event, data } = eventData;

            switch (event) {
              case 'node':
                handleNodeEvent(data as QuickActionNodeEvent['data']);
                nodeCount++;
                break;
              case 'replace':
                handleReplaceEvent(data as QuickActionReplaceEvent['data']);
                if ((data as QuickActionReplaceEvent['data']).isFinal) nodeCount = 1;
                break;
              case 'chunk':
                if (actionType === 'expand' && typeof (data as { content?: string }).content === 'string') {
                  streamedContentRef.current += (data as { content: string }).content;
                  setState((prev) => ({ ...prev, expandedContent: streamedContentRef.current }));
                }
                break;
              case 'done': {
                const doneData = data as { success?: boolean; actionType?: string; content?: string; nodes?: Array<{ tempId: string; content: string; parentTempId: string | null; supertagId: string | null; fields: Record<string, unknown>; confidence: number; isAIExtracted: boolean }> };
                if (actionType === 'expand') {
                  const finalContent = streamedContentRef.current || doneData.content || '';
                  if (finalContent) {
                    setExpandPreview(nodeId, finalContent);
                    nodeCount = 1;
                  }
                }
                if (doneData.actionType === 'deconstruct' && Array.isArray(doneData.nodes)) {
                  setPreview(nodeId, doneData.nodes);
                  nodeCount = doneData.nodes.length;
                }
                break;
              }
              case 'error':
                throw new Error((data as { message?: string }).message || '执行失败');
            }
          } catch (parseError) {
            if (parseError instanceof Error && parseError.message !== '执行失败') throw parseError;
          }
        }
      }

      setState((prev) => ({ ...prev, isExecuting: false, actionType: null, expandedContent: '' }));
      return { success: true, nodeCount };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      if (error instanceof Error && error.name === 'AbortError') {
        setState((prev) => ({ ...prev, isExecuting: false, actionType: null, expandedContent: '', error: '操作已取消' }));
        return { success: false, nodeCount: 0, error: '操作已取消' };
      }
      setState((prev) => ({ ...prev, isExecuting: false, actionType: null, expandedContent: '', error: errorMessage }));
      return { success: false, nodeCount: 0, error: errorMessage };
    } finally {
      abortControllerRef.current = null;
    }
  }, [node, state.isExecuting, nodeId, collectContext, supertags, getFieldDefinitions, setPreview, setExpandPreview, handleNodeEvent, handleReplaceEvent, updateNode]);

  const cancelAction = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return {
    isExecuting: state.isExecuting,
    actionType: state.actionType,
    generatedNodeCount: state.generatedNodeCount,
    replacedContent: state.replacedContent,
    expandedContent: state.expandedContent,
    error: state.error,
    executeAction,
    cancelAction,
  };
}

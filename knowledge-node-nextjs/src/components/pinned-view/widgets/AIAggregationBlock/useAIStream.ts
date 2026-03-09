'use client';

/**
 * useAIStream - AI 流式输出 Hook
 * v3.6: 处理 SSE 流式请求、缓存管理和错误处理
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  AIAggregationQueryConfig,
  AIAggregateEvent,
  StandupSummaryPayload,
} from '@/types/view-config';
import type { Node } from '@/types';

interface UseAIStreamOptions {
  tagId: string;
  query: AIAggregationQueryConfig;
  prompt: string;
  cacheTTL: number;
  nodes: Node[];
}

interface UseAIStreamResult {
  content: string;
  nodeRefs: Array<{ nodeId: string; title: string }>;
  standup: StandupSummaryPayload | null;
  isLoading: boolean;
  error: string | null;
  fromCache: boolean;
  refresh: () => void;
}

/**
 * 计算查询配置的 hash
 */
function hashQuery(query: AIAggregationQueryConfig, prompt: string): string {
  const str = JSON.stringify({ query, prompt });
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * 内存缓存
 */
const memoryCache = new Map<string, {
  content: string;
  nodeRefs: Array<{ nodeId: string; title: string }>;
  standup: StandupSummaryPayload | null;
  timestamp: number;
}>();

/**
 * AI 流式输出 Hook
 */
export function useAIStream({
  tagId,
  query,
  prompt,
  cacheTTL,
  nodes,
}: UseAIStreamOptions): UseAIStreamResult {
  const [content, setContent] = useState('');
  const [nodeRefs, setNodeRefs] = useState<Array<{ nodeId: string; title: string }>>([]);
  const [standup, setStandup] = useState<StandupSummaryPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // 计算缓存 key
  const cacheKey = useMemo(() => {
    return `${tagId}-${hashQuery(query, prompt)}`;
  }, [tagId, query, prompt]);
  
  // 根据 query 过滤节点
  const filteredNodes = useMemo(() => {
    let result = nodes.filter((n) => n.supertagId === tagId);
    
    // 应用过滤条件
    if (query.filters && query.filters.length > 0) {
      result = result.filter((node) => {
        return query.filters.every((filter) => {
          const fieldValue = filter.field === 'content'
            ? node.content
            : node.fields?.[filter.field];
          
          switch (filter.operator) {
            case 'eq':
              return fieldValue === filter.value;
            case 'neq':
              return fieldValue !== filter.value;
            case 'in':
              return Array.isArray(filter.value) && filter.value.includes(fieldValue);
            case 'nin':
              return Array.isArray(filter.value) && !filter.value.includes(fieldValue);
            case 'gt':
              return typeof fieldValue === 'number' && fieldValue > (filter.value as number);
            case 'gte':
              return typeof fieldValue === 'number' && fieldValue >= (filter.value as number);
            case 'lt':
              return typeof fieldValue === 'number' && fieldValue < (filter.value as number);
            case 'lte':
              return typeof fieldValue === 'number' && fieldValue <= (filter.value as number);
            case 'contains':
              return typeof fieldValue === 'string' && fieldValue.includes(filter.value as string);
            case 'startsWith':
              return typeof fieldValue === 'string' && fieldValue.startsWith(filter.value as string);
            case 'endsWith':
              return typeof fieldValue === 'string' && fieldValue.endsWith(filter.value as string);
            default:
              return true;
          }
        });
      });
    }
    
    // 应用数量限制
    if (query.limit && query.limit > 0) {
      result = result.slice(0, query.limit);
    }
    
    return result;
  }, [nodes, tagId, query]);
  
  // 执行 AI 请求
  const fetchAI = useCallback(async (forceRefresh = false) => {
    // 检查内存缓存
    if (!forceRefresh) {
      const cached = memoryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cacheTTL * 1000) {
        setContent(cached.content);
        setNodeRefs(cached.nodeRefs);
        setStandup(cached.standup);
        setFromCache(true);
        return;
      }
    }
    
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // 如果没有节点，不执行请求
    if (filteredNodes.length === 0) {
      setContent('');
      setNodeRefs([]);
      setStandup(null);
      return;
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    setIsLoading(true);
    setError(null);
    setFromCache(false);
    setContent('');
    setNodeRefs([]);
    setStandup(null);
    
    try {
      // 构建上下文
      const contextNodes = filteredNodes.map((n) => ({
        id: n.id,
        content: n.content,
        fields: n.fields,
      }));
      
      const response = await fetch('/api/ai/aggregate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tagId,
          prompt,
          nodes: contextNodes,
          forceRefresh,
        }),
        signal: controller.signal,
      });
      
      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
      }
      
      // 处理 SSE 流
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      const refs: Array<{ nodeId: string; title: string }> = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // 解析 SSE 事件
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6)) as AIAggregateEvent;
              
              if (event.event === 'chunk') {
                fullContent += event.data.text;
                setContent(fullContent);
              } else if (event.event === 'nodeRef') {
                refs.push(event.data);
                setNodeRefs([...refs]);
              } else if (event.event === 'done') {
                // 更新缓存
                const standupPayload = event.data.standup || null;
                setStandup(standupPayload);
                memoryCache.set(cacheKey, {
                  content: event.data.content,
                  nodeRefs: refs,
                  standup: standupPayload,
                  timestamp: Date.now(),
                });
              } else if (event.event === 'error') {
                throw new Error(event.data.message);
              }
            } catch (parseError) {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // 请求被取消，忽略
        return;
      }
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, cacheTTL, filteredNodes, prompt, tagId]);
  
  // 初始加载
  useEffect(() => {
    fetchAI();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchAI]);
  
  // 手动刷新
  const refresh = useCallback(() => {
    fetchAI(true);
  }, [fetchAI]);
  
  return {
    content,
    nodeRefs,
    standup,
    isLoading,
    error,
    fromCache,
    refresh,
  };
}

export default useAIStream;

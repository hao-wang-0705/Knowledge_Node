/**
 * Agent 服务
 * 前端调用后端 Agent API 的统一入口
 */

import { API_BASE_URL } from '@/lib/api';

/**
 * Agent 请求参数
 */
export interface AgentExecuteRequest {
  /** 用户 ID */
  userId: string;
  /** 节点 ID */
  nodeId?: string;
  /** 用户指令 */
  prompt: string;
  /** 上下文 */
  context?: {
    nodes?: Array<{
      id: string;
      title: string;
      content?: string;
      fields?: Record<string, unknown>;
    }>;
    fields?: Record<string, unknown>;
    selectedText?: string;
    metadata?: Record<string, unknown>;
  };
  /** 选项 */
  options?: {
    stream?: boolean;
    maxSteps?: number;
    timeout?: number;
    forceTool?: string;
    modelConfig?: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
    };
    includePlan?: boolean;
  };
}

/**
 * Agent 响应（非流式）
 */
export interface AgentResponse {
  success: boolean;
  content?: string;
  plan?: {
    id: string;
    steps: Array<{
      tool: string;
      status: string;
      output?: string;
    }>;
  };
  metadata?: {
    tokensUsed?: number;
    executionTime?: number;
    toolsUsed?: string[];
  };
  error?: string;
}

/**
 * 流式事件类型
 */
export type AgentStreamEventType =
  | 'started'
  | 'analyzing'
  | 'intent'
  | 'context'
  | 'plan_created'
  | 'step_started'
  | 'step_chunk'
  | 'step_completed'
  | 'step_failed'
  | 'plan_completed'
  | 'plan_failed'
  | 'chunk'
  | 'done'
  | 'error';

/**
 * 流式事件
 */
export interface AgentStreamEvent {
  event: AgentStreamEventType;
  data: unknown;
}

/**
 * 快捷动作类型
 */
export type QuickActionType =
  | 'expand'
  | 'deconstruct';

/**
 * 快捷动作请求
 */
export interface QuickActionRequest {
  userId: string;
  nodeId: string;
  action: QuickActionType;
  selectedContent?: string;
  params?: Record<string, unknown>;
}

/**
 * 工具信息
 */
export interface ToolInfo {
  name: string;
  description: string;
  category: string;
}

/**
 * 流式回调
 */
export interface AgentStreamCallbacks {
  onEvent?: (event: AgentStreamEvent) => void;
  onChunk?: (content: string) => void;
  onComplete?: (content: string) => void;
  onError?: (error: string) => void;
  onPlanCreated?: (plan: { id: string; steps: Array<{ id: string; tool: string }> }) => void;
  onStepStarted?: (stepId: string, tool: string) => void;
  onStepCompleted?: (stepId: string, tool: string, content: string) => void;
}

/**
 * 执行 Agent 请求（流式）
 */
export async function executeAgentStream(
  request: AgentExecuteRequest,
  callbacks: AgentStreamCallbacks = {},
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/agent/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...request,
      options: { ...request.options, stream: true },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    callbacks.onError?.(error);
    throw new Error(error);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('无法读取响应流');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event: AgentStreamEvent = JSON.parse(line.slice(6));
            callbacks.onEvent?.(event);

            // 处理特定事件
            switch (event.event) {
              case 'step_chunk': {
                const content = (event.data as { content?: string })?.content;
                if (content) {
                  fullContent += content;
                  callbacks.onChunk?.(content);
                }
                break;
              }
              case 'plan_created': {
                callbacks.onPlanCreated?.(event.data as { id: string; steps: Array<{ id: string; tool: string }> });
                break;
              }
              case 'step_started': {
                const { stepId, tool } = event.data as { stepId: string; tool: string };
                callbacks.onStepStarted?.(stepId, tool);
                break;
              }
              case 'step_completed': {
                const { stepId, tool, content } = event.data as { stepId: string; tool: string; content: string };
                callbacks.onStepCompleted?.(stepId, tool, content);
                break;
              }
              case 'done': {
                callbacks.onComplete?.(fullContent);
                break;
              }
              case 'error': {
                const errorMsg = (event.data as { message?: string })?.message || '执行失败';
                callbacks.onError?.(errorMsg);
                break;
              }
            }
          } catch (e) {
            console.error('Failed to parse SSE event:', e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullContent;
}

/**
 * 执行 Agent 请求（非流式）
 */
export async function executeAgent(request: AgentExecuteRequest): Promise<AgentResponse> {
  const response = await fetch(`${API_BASE_URL}/api/agent/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...request,
      options: { ...request.options, stream: false },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

/**
 * 执行快捷动作（流式）
 */
export async function executeQuickAction(
  request: QuickActionRequest,
  callbacks: AgentStreamCallbacks = {},
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/agent/quick-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    callbacks.onError?.(error);
    throw new Error(error);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('无法读取响应流');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event: AgentStreamEvent = JSON.parse(line.slice(6));
            callbacks.onEvent?.(event);

            if (event.event === 'chunk') {
              const content = (event.data as { content?: string })?.content;
              if (content) {
                fullContent += content;
                callbacks.onChunk?.(content);
              }
            } else if (event.event === 'done') {
              callbacks.onComplete?.(fullContent);
            } else if (event.event === 'error') {
              const errorMsg = (event.data as { message?: string })?.message || '执行失败';
              callbacks.onError?.(errorMsg);
            }
          } catch (e) {
            console.error('Failed to parse SSE event:', e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullContent;
}

/**
 * 获取可用工具列表
 */
export async function getAvailableTools(): Promise<ToolInfo[]> {
  const response = await fetch(`${API_BASE_URL}/api/agent/tools`);
  
  if (!response.ok) {
    throw new Error('获取工具列表失败');
  }

  const result = await response.json();
  return result.tools;
}

/**
 * 检查 Agent 服务健康状态
 */
export async function checkAgentHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/agent/health`);
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// 专用工具方法
// ============================================================================

/**
 * 快速捕获请求
 */
export interface CaptureToolRequest {
  userId: string;
  text?: string;
  imageCount?: number;
  voiceTranscription?: string;
  manualTagId?: string;
  supertags: Array<{
    id: string;
    name: string;
    icon?: string;
    description?: string;
    fields: Array<{ key: string; name: string; type: string; options?: string[] }>;
  }>;
}

/**
 * 快速捕获响应
 */
export interface CaptureToolResponse {
  content: string;
  supertagId: string | null;
  fields: Record<string, unknown>;
  confidence: number;
  alternativeTags?: string[];
}

/**
 * 快速捕获
 */
export async function capture(request: CaptureToolRequest): Promise<CaptureToolResponse> {
  const response = await executeAgent({
    userId: request.userId,
    prompt: request.text || request.voiceTranscription || '',
    options: { stream: false, forceTool: 'capture' },
    context: {
      metadata: {
        text: request.text,
        imageCount: request.imageCount,
        voiceTranscription: request.voiceTranscription,
        manualTagId: request.manualTagId,
        supertags: request.supertags,
      },
    },
  });

  if (!response.success || !response.content) {
    throw new Error(response.error || '快速捕获失败');
  }

  return JSON.parse(response.content);
}

/**
 * 智能捕获请求
 */
export interface SmartCaptureToolRequest {
  userId: string;
  text: string;
  supertags: Array<{
    id: string;
    name: string;
    icon?: string;
    description?: string;
    fields: Array<{ key: string; name: string; type: string; options?: string[] }>;
  }>;
  confidenceThreshold?: number;
}

/**
 * 智能捕获节点
 */
export interface SmartCaptureNode {
  tempId: string;
  content: string;
  parentTempId: string | null;
  supertagId: string | null;
  fields: Record<string, unknown>;
  confidence: number;
  isAIExtracted: boolean;
}

/**
 * 智能捕获（流式）
 */
export async function smartCapture(
  request: SmartCaptureToolRequest,
  callbacks: {
    onNode?: (node: SmartCaptureNode) => void;
    onComplete?: (nodes: SmartCaptureNode[]) => void;
    onError?: (error: string) => void;
  } = {},
): Promise<SmartCaptureNode[]> {
  const nodes: SmartCaptureNode[] = [];

  await executeAgentStream(
    {
      userId: request.userId,
      prompt: request.text,
      options: { stream: true, forceTool: 'smart_capture' },
      context: {
        metadata: {
          text: request.text,
          supertags: request.supertags,
          confidenceThreshold: request.confidenceThreshold ?? 0.8,
        },
      },
    },
    {
      onChunk: () => {},
      onComplete: (content) => {
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            nodes.push(...parsed);
          }
          callbacks.onComplete?.(nodes);
        } catch {
          callbacks.onComplete?.(nodes);
        }
      },
      onError: callbacks.onError,
    },
  );

  return nodes;
}

/**
 * 聚合分析请求
 */
export interface AggregateToolRequest {
  userId: string;
  query: string;
  mode?: 'summarize' | 'extract' | 'analyze' | 'custom';
  outputFormat?: string;
  nodes: Array<{
    id: string;
    title: string;
    content?: string;
    fields?: Record<string, unknown>;
  }>;
}

/**
 * 聚合分析（流式）
 */
export async function aggregate(
  request: AggregateToolRequest,
  callbacks: AgentStreamCallbacks = {},
): Promise<string> {
  return executeAgentStream(
    {
      userId: request.userId,
      prompt: request.query,
      options: { stream: true, forceTool: 'aggregate' },
      context: {
        nodes: request.nodes,
        metadata: {
          mode: request.mode || 'custom',
          outputFormat: request.outputFormat,
        },
      },
    },
    callbacks,
  );
}

/**
 * 搜索 NL 解析请求
 */
export interface SearchNLParseToolRequest {
  userId: string;
  query: string;
  supertags: Array<{
    id: string;
    name: string;
    icon?: string;
    fields: Array<{ key: string; name: string; type: string; options?: string[] }>;
  }>;
  currentDate?: string;
}

/**
 * 搜索 NL 解析响应
 */
export interface SearchNLParseToolResponse {
  success: boolean;
  config?: {
    logicalOperator: 'AND' | 'OR';
    conditions: Array<{
      type: 'keyword' | 'tag' | 'field' | 'date' | 'ancestor';
      field?: string;
      operator: string;
      value: string | number | boolean | string[];
      negate?: boolean;
    }>;
  };
  explanation?: string;
  warnings?: string[];
  confidence?: number;
  error?: string;
  suggestions?: string[];
}

/**
 * 搜索 NL 解析
 */
export async function parseSearchNL(request: SearchNLParseToolRequest): Promise<SearchNLParseToolResponse> {
  const response = await executeAgent({
    userId: request.userId,
    prompt: request.query,
    options: { stream: false, forceTool: 'search_nl_parse' },
    context: {
      metadata: {
        query: request.query,
        supertags: request.supertags,
        currentDate: request.currentDate || new Date().toISOString().split('T')[0],
      },
    },
  });

  if (!response.success || !response.content) {
    return {
      success: false,
      error: response.error || '解析失败',
      suggestions: ['请重试或使用手动配置模式'],
    };
  }

  return JSON.parse(response.content);
}


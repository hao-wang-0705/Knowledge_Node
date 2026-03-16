/**
 * AI 智能结构化 API 端点
 * POST /api/ai/smart-structure
 *
 * 统一的文本结构化入口，替代原 capture + smart-capture + smart-deconstruct
 * 支持三种模式：quick（单节点快速捕获）、structure（多层级结构化）、deconstruct（已有节点解构）
 * 支持 SSE 流式输出（structure/deconstruct 模式）和 JSON 响应（quick 模式）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// ============================================================================
// 类型定义
// ============================================================================

interface SmartStructureRequest {
  text: string;
  supertags: Array<{
    id: string;
    name: string;
    icon?: string;
    description?: string;
    category?: 'entity' | 'action';
    fields: Array<{
      key: string;
      name: string;
      type: string;
      options?: string[];
      targetTagId?: string;
      targetTagIds?: string[];
      multiple?: boolean;
      statusConfig?: {
        states: string[];
        initial: string;
        doneState?: string;
      };
    }>;
  }>;
  mode: 'quick' | 'structure' | 'deconstruct';
  nodeId?: string;
  manualTagId?: string;
  maxDepth?: number;
}

// ============================================================================
// SSE 工具
// ============================================================================

function createSSEEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ============================================================================
// API Handler
// ============================================================================

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: '未登录，请先登录后再使用 AI 功能' },
      { status: 401 },
    );
  }

  let body: SmartStructureRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: '无效的请求格式' },
      { status: 400 },
    );
  }

  if (!body.text?.trim()) {
    return NextResponse.json(
      { success: false, error: '请提供要处理的文本内容' },
      { status: 400 },
    );
  }

  const mode = body.mode || 'quick';

  // quick 模式：非流式 JSON 响应
  if (mode === 'quick') {
    return handleQuickMode(body, session.user.id);
  }

  // structure / deconstruct 模式：SSE 流式响应
  return handleStreamMode(body, session.user.id);
}

// ============================================================================
// Quick 模式（非流式）
// ============================================================================

async function handleQuickMode(
  body: SmartStructureRequest,
  userId: string,
): Promise<NextResponse> {
  try {
    const backendUrl =
      process.env.BACKEND_API_URL ||
      process.env.BACKEND_URL ||
      'http://localhost:4000';

    const response = await fetch(`${backendUrl}/api/agent/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        prompt: body.text.trim(),
        options: {
          stream: false,
          forceTool: 'smart_structure',
        },
        context: {
          metadata: {
            text: body.text.trim(),
            supertags: body.supertags || [],
            mode: 'quick',
            manualTagId: body.manualTagId,
            maxDepth: body.maxDepth ?? 3,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: '后端请求失败' }));
      return NextResponse.json(
        { success: false, error: errorData.message || 'AI 服务请求失败' },
        { status: response.status },
      );
    }

    const result = await response.json();

    let data = result;
    if (result.content) {
      try {
        data = JSON.parse(result.content);
      } catch {
        data = { nodes: [], entityMentions: [] };
      }
    }

    return NextResponse.json({
      success: true,
      data,
      meta: {
        mode: 'quick',
        tokensUsed: result.metadata?.tokensUsed,
      },
    });
  } catch (error) {
    console.error('[AI Smart Structure Quick Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '处理失败',
      },
      { status: 500 },
    );
  }
}

// ============================================================================
// Stream 模式（SSE）
// ============================================================================

async function handleStreamMode(
  body: SmartStructureRequest,
  userId: string,
): Promise<Response> {
  const backendUrl =
    process.env.BACKEND_API_URL ||
    process.env.BACKEND_URL ||
    'http://localhost:4000';

  try {
    const response = await fetch(`${backendUrl}/api/agent/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        prompt: body.text.trim(),
        options: {
          stream: true,
          forceTool: 'smart_structure',
        },
        context: {
          metadata: {
            text: body.text.trim(),
            supertags: body.supertags || [],
            mode: body.mode,
            nodeId: body.nodeId,
            manualTagId: body.manualTagId,
            maxDepth: body.maxDepth ?? 3,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: '后端请求失败' }));
      return new Response(
        JSON.stringify({
          success: false,
          error: errorData.message || 'AI 服务请求失败',
        }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;

              const raw = line.slice(6);

              let eventObj: { event?: string; data?: Record<string, unknown> };
              try {
                eventObj = JSON.parse(raw);
              } catch {
                controller.enqueue(encoder.encode(`data: ${raw}\n\n`));
                continue;
              }

              const event = eventObj.event;
              const data = eventObj.data;

              if (!event) {
                controller.enqueue(encoder.encode(`data: ${raw}\n\n`));
                continue;
              }

              switch (event) {
                case 'step_chunk': {
                  controller.enqueue(
                    encoder.encode(createSSEEvent('chunk', data)),
                  );
                  break;
                }
                case 'done': {
                  const content = (data as { content?: string })?.content;
                  if (content) {
                    try {
                      const parsed = JSON.parse(content);
                      const nodes = parsed.nodes || parsed;
                      const entityMentions = parsed.entityMentions || [];

                      if (Array.isArray(nodes)) {
                        for (const node of nodes) {
                          controller.enqueue(
                            encoder.encode(createSSEEvent('node', node)),
                          );
                        }
                      }

                      controller.enqueue(
                        encoder.encode(
                          createSSEEvent('done', {
                            success: true,
                            nodeCount: Array.isArray(nodes) ? nodes.length : 0,
                            entityMentionCount: entityMentions.length,
                            mode: body.mode,
                          }),
                        ),
                      );
                    } catch {
                      controller.enqueue(
                        encoder.encode(
                          createSSEEvent('done', { success: true, mode: body.mode }),
                        ),
                      );
                    }
                  } else {
                    controller.enqueue(
                      encoder.encode(
                        createSSEEvent('done', { success: true, mode: body.mode }),
                      ),
                    );
                  }
                  break;
                }
                case 'error': {
                  const message =
                    (data as { message?: string })?.message ||
                    (data as { error?: string })?.error ||
                    '智能结构化执行失败';
                  controller.enqueue(
                    encoder.encode(createSSEEvent('error', { message })),
                  );
                  break;
                }
                default: {
                  controller.enqueue(encoder.encode(`data: ${raw}\n\n`));
                }
              }
            }
          }
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              createSSEEvent('error', {
                message:
                  error instanceof Error ? error.message : '流处理失败',
              }),
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : '处理失败',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

// GET 用于健康检查
export async function GET() {
  const backendUrl =
    process.env.BACKEND_API_URL ||
    process.env.BACKEND_URL ||
    'http://localhost:4000';

  try {
    const response = await fetch(`${backendUrl}/api/agent/health`);
    const data = await response.json();

    return NextResponse.json({
      service: 'ai-smart-structure',
      version: '5.0',
      available: data.status === 'ok',
      modes: ['quick', 'structure', 'deconstruct'],
      features: [
        'text-structuring',
        'tag-matching',
        'field-extraction',
        'entity-recognition',
        'entity-linking',
        'streaming-output',
      ],
      timestamp: Date.now(),
    });
  } catch {
    return NextResponse.json({
      service: 'ai-smart-structure',
      available: false,
      error: '后端服务不可用',
      timestamp: Date.now(),
    });
  }
}

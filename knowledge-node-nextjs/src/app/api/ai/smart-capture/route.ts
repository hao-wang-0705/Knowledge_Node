/**
 * AI 智能捕获 API 端点
 * POST /api/ai/smart-capture
 * 
 * 透传到后端 Agent API，支持 SSE 流式输出
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { type SmartCaptureTagSchema } from '@/services/ai/prompts';

// ============================================================================
// 类型定义
// ============================================================================

interface SmartCaptureRequest {
  text: string;
  supertags: SmartCaptureTagSchema[];
  confidenceThreshold?: number;
}

// ============================================================================
// SSE 工具函数
// ============================================================================

function createSSEEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ============================================================================
// API Handler
// ============================================================================

export async function POST(request: NextRequest) {
  // 验证用户身份
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(
      JSON.stringify({ success: false, error: '未登录，请先登录后再使用 AI 功能' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 解析请求体
  let body: SmartCaptureRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: '无效的请求格式' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 验证输入
  if (!body.text?.trim()) {
    return new Response(
      JSON.stringify({ success: false, error: '请提供要处理的文本内容' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 调用后端 Agent API（流式）
  const backendUrl = process.env.BACKEND_API_URL || process.env.BACKEND_URL || 'http://localhost:4000';

  try {
    const response = await fetch(`${backendUrl}/api/agent/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: session.user.id,
        prompt: body.text.trim(),
        options: {
          stream: true,
          forceTool: 'smart_capture',
        },
        context: {
          metadata: {
            text: body.text.trim(),
            supertags: body.supertags || [],
            confidenceThreshold: body.confidenceThreshold ?? 0.8,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: '后端请求失败' }));
      return new Response(
        JSON.stringify({ success: false, error: errorData.message || 'AI 服务请求失败' }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 转发 SSE 流
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

              // 后端 Agent 网关通过 sendSSE 输出 { event, data } 结构
              let eventObj: { event?: string; data?: any };
              try {
                eventObj = JSON.parse(raw);
              } catch {
                // 无法解析的行原样透传，避免中断连接
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
                  // 智能捕获的中间文本块，目前前端 UI 不强依赖，可视为进度信息
                  controller.enqueue(encoder.encode(`data: ${raw}\n\n`));
                  break;
                }
                case 'done': {
                  // AgentGateway.done 的 data.content 中应包含完整的 JSON 字符串
                  const content = (data as { content?: string })?.content;
                  if (content) {
                    try {
                      const nodes = JSON.parse(content || '[]');
                      if (Array.isArray(nodes)) {
                        for (const node of nodes) {
                          controller.enqueue(encoder.encode(createSSEEvent('node', node)));
                        }
                        controller.enqueue(
                          encoder.encode(
                            createSSEEvent('done', {
                              success: true,
                              nodeCount: nodes.length,
                            }),
                          ),
                        );
                      } else {
                        controller.enqueue(
                          encoder.encode(
                            createSSEEvent('done', {
                              success: true,
                            }),
                          ),
                        );
                      }
                    } catch {
                      controller.enqueue(
                        encoder.encode(
                          createSSEEvent('done', {
                            success: true,
                          }),
                        ),
                      );
                    }
                  } else {
                    controller.enqueue(
                      encoder.encode(
                        createSSEEvent('done', {
                          success: true,
                        }),
                      ),
                    );
                  }
                  break;
                }
                case 'error': {
                  const message =
                    (data as { message?: string })?.message ||
                    (data as { error?: string })?.error ||
                    '智能捕获执行失败';
                  controller.enqueue(
                    encoder.encode(
                      createSSEEvent('error', {
                        message,
                      }),
                    ),
                  );
                  break;
                }
                default: {
                  // 其他事件（started/plan_created/step_started/plan_completed 等）保持透传
                  controller.enqueue(encoder.encode(`data: ${raw}\n\n`));
                }
              }
            }
          }
        } catch (error) {
          controller.enqueue(encoder.encode(createSSEEvent('error', { message: error instanceof Error ? error.message : '流处理失败' })));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : '处理失败' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// GET 请求用于健康检查
export async function GET() {
  const backendUrl = process.env.BACKEND_API_URL || process.env.BACKEND_URL || 'http://localhost:4000';

  try {
    const response = await fetch(`${backendUrl}/api/agent/health`);
    const data = await response.json();

    return new Response(
      JSON.stringify({
        service: 'ai-smart-capture',
        version: '4.0',
        available: data.status === 'ok',
        features: ['text-formatting', 'tag-matching', 'field-extraction', 'streaming-output'],
        timestamp: Date.now(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({
        service: 'ai-smart-capture',
        available: false,
        error: '后端服务不可用',
        timestamp: Date.now(),
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

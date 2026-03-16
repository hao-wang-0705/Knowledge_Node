# Agent 架构接入指引

本文档提供了在 Knowledge Node 平台中接入新 AI 功能的标准化流程和规范。

## 目录

1. [架构概述](#架构概述)
2. [工具开发规范](#工具开发规范)
3. [工具注册流程](#工具注册流程)
4. [意图映射配置](#意图映射配置)
5. [API 调用方式](#api-调用方式)
6. [测试要求](#测试要求)
7. [常见问题](#常见问题)

---

## 架构概述

Agent 架构采用分层设计，核心组件包括：

```
AgentGateway (统一入口)
    ↓
IntentAnalyzer (意图分析)
    ↓
PlanGenerator (计划生成)
    ↓
ChainExecutor (链式执行)
    ↓
ToolRegistry → [Tool1, Tool2, ...] (工具执行)
```

### 核心组件职责

| 组件 | 职责 |
|------|------|
| AgentGateway | 统一入口，请求验证，SSE 流式响应管理 |
| IntentAnalyzer | 分析用户意图，推荐工具 |
| PlanGenerator | 生成执行计划，处理多步任务 |
| ChainExecutor | 按依赖顺序执行步骤，传递上下文 |
| ToolRegistry | 工具注册中心，管理工具生命周期 |

---

## 工具开发规范

### 1. 工具接口定义

所有工具必须实现 `AITool` 接口：

```typescript
interface AITool<TInput, TOutput> {
  // 工具唯一标识（小写下划线格式）
  readonly name: string;
  
  // 工具描述（用于意图识别匹配）
  readonly description: string;
  
  // 输入参数 JSON Schema
  readonly inputSchema: Record<string, unknown>;
  
  // 工具分类
  readonly category: ToolCategory;
  
  // 是否需要上下文节点
  readonly requiresContext: boolean;
  
  // 执行方法（返回 AsyncGenerator 支持流式输出）
  execute(input: TInput, context: ExecutionContext): AsyncGenerator<TOutput>;
  
  // 输入验证
  validateInput(input: TInput): { valid: boolean; errors?: string[] };
}
```

### 2. 继承 BaseTool 基类

推荐继承 `BaseTool` 基类，获得通用功能：

```typescript
import { BaseTool } from './base.tool';
import { ToolInput, ToolOutput, ToolCategory, ExecutionContext } from '../interfaces';

// 定义工具输入类型
export interface MyToolInput extends ToolInput {
  prompt: string;
  customParam?: string;
}

export class MyNewTool extends BaseTool<MyToolInput, ToolOutput> {
  // 必填：工具唯一标识
  readonly name = 'my_new_tool';
  
  // 必填：工具描述（影响意图识别）
  readonly description = '我的新工具，用于处理特定场景';
  
  // 必填：工具分类
  readonly category: ToolCategory = 'productivity';
  
  // 必填：是否需要上下文
  readonly requiresContext = true;
  
  // 必填：输入 Schema
  readonly inputSchema = {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: '用户指令',
      },
      customParam: {
        type: 'string',
        description: '自定义参数',
      },
    },
    required: ['prompt'],
  };

  // 必填：执行方法
  async *execute(input: MyToolInput, context: ExecutionContext): AsyncGenerator<ToolOutput> {
    try {
      // 1. 发送元数据
      yield this.createMetadata({ startTime: Date.now() });
      
      // 2. 执行核心逻辑
      const client = this.getClient(); // 获取 OpenAI 客户端
      const stream = await client.chat.completions.create({
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: '你是一个专业助手' },
          { role: 'user', content: input.prompt },
        ],
        stream: true,
      });
      
      // 3. 流式输出
      let fullContent = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          yield this.createChunk(content);
        }
      }
      
      // 4. 完成输出
      yield this.createComplete(fullContent, { tokensUsed: fullContent.length / 2 });
    } catch (error) {
      yield this.createError(error instanceof Error ? error.message : '执行失败');
    }
  }
}
```

### 3. 工具分类

| 分类 | 说明 | 示例 |
|------|------|------|
| productivity | 生产力工具 | 任务管理、日程规划 |
| analysis | 分析工具 | 数据分析、趋势洞察 |
| creative | 创意工具 | 内容创作、头脑风暴 |
| summary | 总结工具 | 摘要提炼、要点归纳 |
| search | 搜索工具 | 本地搜索、联网搜索 |
| expansion | 扩展工具 | 内容扩写、详细展开 |
| transform | 转换工具 | 格式转换、语音转写 |
| extraction | 提取工具 | 信息提取、实体识别 |

### 4. 输出类型

```typescript
interface ToolOutput {
  type: 'chunk' | 'complete' | 'error' | 'metadata';
  content?: string;      // chunk/complete 时的文本内容
  metadata?: Record<string, unknown>;  // metadata 时的元数据
  error?: string;        // error 时的错误信息
}
```

使用 BaseTool 的辅助方法：

```typescript
yield this.createChunk('部分内容');        // 流式输出块
yield this.createComplete('完整内容');     // 完成输出
yield this.createError('错误信息');        // 错误输出
yield this.createMetadata({ key: value }); // 元数据输出
```

---

## 工具注册流程

### 1. 创建工具文件

在 `src/modules/agent/tools/` 目录下创建工具文件：

```
tools/
├── base.tool.ts
├── tool.registry.ts
├── text-generate.tool.ts
├── web-search.tool.ts
├── my-new-tool.ts          # 新工具文件
└── index.ts
```

### 2. 导出工具

在 `tools/index.ts` 中导出：

```typescript
export * from './my-new-tool';
```

### 3. 注册工具

在 `agent.module.ts` 中注册：

```typescript
import { MyNewTool } from './tools/my-new-tool';

const createToolRegistry = () => {
  const registry = new ToolRegistry();
  registry.register(new TextGenerateTool());
  registry.register(new WebSearchTool());
  registry.register(new MyNewTool());  // 注册新工具
  return registry;
};
```

### 4. 注册优先级

可选择性设置工具优先级：

```typescript
registry.register(new MyNewTool(), 10);  // 优先级 10（默认 0）
```

优先级越高，在同类别工具中被优先选择的可能性越大。

---

## 意图映射配置

意图分析器会根据工具的 `description` 自动匹配。如需增强识别准确率，可在 `IntentAnalyzer` 的规则分析方法中添加关键词：

```typescript
// analyzer/intent.analyzer.ts

private ruleBasedAnalysis(prompt: string): IntentAnalysisResult {
  // 添加新工具的关键词匹配
  const myToolKeywords = ['特定场景', '自定义功能', '新工具'];
  if (myToolKeywords.some(kw => prompt.includes(kw))) {
    return {
      primaryIntent: '特定场景处理',
      recommendedTools: ['my_new_tool'],
      confidence: 0.8,
      requiresContext: true,
      actionStrategy: 'append_children',
    };
  }
  
  // ... 其他规则
}
```

---

## API 调用方式

### 1. 流式调用（推荐）

```typescript
// 前端调用示例
const response = await fetch('/api/agent/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user-123',
    nodeId: 'node-456',  // 可选
    prompt: '帮我总结这些内容',
    context: {
      nodes: [{ id: 'n1', title: '节点1', content: '内容...' }],
    },
    options: {
      stream: true,  // 默认 true
      maxSteps: 5,
    },
  }),
});

// 处理 SSE 流
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const lines = decoder.decode(value).split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const event = JSON.parse(line.slice(6));
      console.log(event.event, event.data);
    }
  }
}
```

### 2. 非流式调用

```typescript
const response = await fetch('/api/agent/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user-123',
    prompt: '帮我总结这些内容',
    options: {
      stream: false,
    },
  }),
});

const result = await response.json();
// { success: true, content: '...', metadata: { ... } }
```

### 3. 快捷动作

```typescript
const response = await fetch('/api/agent/quick-action', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user-123',
    nodeId: 'node-456',
    action: 'expand',  // expand | deconstruct
    selectedContent: '需要处理的文本内容',
  }),
});
```

### 4. 获取可用工具

```typescript
const response = await fetch('/api/agent/tools');
const { tools } = await response.json();
// [{ name: 'text_generate', description: '...', category: 'creative' }, ...]
```

---

## 测试要求

### 1. 单元测试

每个工具必须有对应的单元测试：

```typescript
// tools/__tests__/my-new-tool.spec.ts

describe('MyNewTool', () => {
  let tool: MyNewTool;
  
  beforeEach(() => {
    tool = new MyNewTool();
  });
  
  it('should have correct metadata', () => {
    expect(tool.name).toBe('my_new_tool');
    expect(tool.category).toBe('productivity');
  });
  
  it('should validate input correctly', () => {
    const result = tool.validateInput({ prompt: 'test' });
    expect(result.valid).toBe(true);
  });
  
  it('should execute and return output', async () => {
    const context = { userId: 'test-user' };
    const outputs: ToolOutput[] = [];
    
    for await (const output of tool.execute({ prompt: 'test' }, context)) {
      outputs.push(output);
    }
    
    expect(outputs.some(o => o.type === 'complete')).toBe(true);
  });
});
```

### 2. 集成测试

验证完整调用链：

```typescript
describe('Agent Integration', () => {
  it('should execute full flow', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/agent/execute')
      .send({
        userId: 'test-user',
        prompt: '测试指令',
        options: { stream: false },
      });
    
    expect(response.body.success).toBe(true);
    expect(response.body.content).toBeTruthy();
  });
});
```

### 3. 性能要求

- 首字节响应延迟 < 500ms
- 工具执行超时设置为 30s
- 流式输出间隔 < 100ms

---

## 常见问题

### Q: 如何处理长时间运行的任务？

A: 使用流式输出，定期发送 `chunk` 事件保持连接：

```typescript
async *execute(input, context) {
  for (const step of longRunningSteps) {
    // 执行步骤
    await processStep(step);
    // 发送进度
    yield this.createChunk(`完成步骤 ${step.name}\n`);
  }
}
```

### Q: 如何访问上下文节点？

A: 通过 `context.nodes` 获取：

```typescript
async *execute(input, context) {
  if (context.nodes && context.nodes.length > 0) {
    for (const node of context.nodes) {
      console.log(node.id, node.title, node.content);
    }
  }
}
```

### Q: 如何获取前置步骤的输出？

A: 多步任务中，通过 `context.previousOutputs` 访问：

```typescript
async *execute(input, context) {
  const previousResult = context.previousOutputs?.get('step-1');
  if (previousResult) {
    // 使用前置步骤的输出
  }
}
```

### Q: 如何自定义 AI 模型？

A: 通过 `context.config` 或环境变量配置：

```typescript
async *execute(input, context) {
  const model = context.config?.model || process.env.AI_MODEL || 'gpt-4o-mini';
  // 使用指定模型
}
```

---

## 更新日志

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-03-10 | 初始版本 |

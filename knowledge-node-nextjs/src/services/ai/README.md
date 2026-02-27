# AI 服务模块

统一的 AI 服务接口，为指令节点系统提供 AI 能力支持。

## 特性

- ✅ **统一接口**：所有 AI 功能通过统一的客户端调用
- ✅ **多提供商支持**：OpenAI、Anthropic、Venus（腾讯）、自定义 API
- ✅ **流式输出**：支持流式响应，实时展示生成内容
- ✅ **严格错误处理**：详细的错误类型和错误消息，禁止 mock 数据兜底
- ✅ **Prompt 集中管理**：所有模板和提示词统一管理
- ✅ **Token 估算**：自动估算和限制 Token 使用

## 快速开始

### 1. 配置环境变量

在 `.env.local` 中配置 AI API：

```bash
# 方式一：OpenAI
OPENAI_API_KEY="sk-xxx"

# 方式二：Venus（腾讯内部）
VENUS_API_KEY="your-key"
NEXT_PUBLIC_VENUS_API_URL="https://api.venus.example.com/v1"

# 方式三：通用配置
AI_API_KEY="your-key"
NEXT_PUBLIC_AI_API_URL="https://api.example.com/v1"
NEXT_PUBLIC_AI_PROVIDER="custom"
```

### 2. 检查服务状态

```typescript
import { isAIAvailable, getAIStatus } from '@/services/ai';

if (!isAIAvailable()) {
  const status = getAIStatus();
  console.error('AI 服务不可用:', status.errors);
  // 显示错误信息给用户
}
```

### 3. 执行 AI 请求

#### 非流式调用

```typescript
import { aiComplete } from '@/services/ai';

try {
  const response = await aiComplete({
    prompt: '帮我总结这段内容',
    variables: { context: '...' },
    category: 'summary',
  });
  
  console.log(response.content);
} catch (error) {
  // 错误已经是 AIServiceError 类型
  console.error(error.message);
  console.error(error.suggestion); // 解决建议
}
```

#### 流式调用

```typescript
import { aiStream } from '@/services/ai';

try {
  for await (const chunk of aiStream({ prompt: '...' })) {
    process.stdout.write(chunk); // 实时输出
  }
} catch (error) {
  console.error('流式输出失败:', error.message);
}
```

### 4. 使用预设模板

```typescript
import { 
  getTemplateById, 
  fillPromptVariables,
  aiComplete 
} from '@/services/ai';

// 获取模板
const template = getTemplateById('weekly-report');

// 填充变量
const prompt = fillPromptVariables(template.prompt, {
  context: '本周工作内容...',
  date: new Date().toLocaleDateString(),
});

// 执行
const result = await aiComplete({ 
  prompt,
  category: template.category,
});
```

## 错误处理

所有错误都会抛出 `AIServiceError`，包含详细信息：

```typescript
import { AIServiceError, AIErrorCode } from '@/services/ai';

try {
  await aiComplete({ prompt: '' });
} catch (error) {
  if (error instanceof AIServiceError) {
    console.log(error.code);        // AI_CONFIG_1004
    console.log(error.message);     // "未提供有效的 Prompt 内容"
    console.log(error.suggestion);  // "请输入指令内容或选择一个预设模板"
    console.log(error.retryable);   // false
    console.log(error.httpStatus);  // 400
  }
}
```

### 错误代码

| 代码 | 说明 |
|------|------|
| `AI_CONFIG_1001` | API 密钥未配置 |
| `AI_CONFIG_1002` | API URL 未配置 |
| `AI_CONFIG_1003` | 模型无效 |
| `AI_CONFIG_1004` | Prompt 为空 |
| `AI_NETWORK_2001` | 网络连接失败 |
| `AI_NETWORK_2002` | 请求超时 |
| `AI_API_3001` | API 密钥无效 |
| `AI_API_3003` | 请求频率超限 |
| `AI_API_3005` | 配额用尽 |
| `AI_EXEC_4001` | 上下文过长 |
| `AI_EXEC_4004` | 空响应 |

## API 端点

### POST /api/ai/command

执行 AI 指令。

请求体：
```json
{
  "prompt": "帮我总结这段内容",
  "context": "要处理的内容...",
  "templateId": "content-summary",
  "model": "gpt-4",
  "maxTokens": 4000,
  "stream": true
}
```

### GET /api/ai/status

检查 AI 服务状态。

响应：
```json
{
  "status": "available",
  "available": true,
  "errors": [],
  "configuration": {
    "provider": "openai",
    "defaultModel": "gpt-4",
    "streamingEnabled": true
  }
}
```

## 预设模板

| ID | 名称 | 分类 |
|----|------|------|
| `weekly-report` | 周报生成器 | productivity |
| `meeting-notes` | 会议纪要整理 | productivity |
| `task-breakdown` | 任务拆解 | productivity |
| `daily-summary` | 日报生成 | productivity |
| `content-summary` | 内容摘要 | summary |
| `insight-extraction` | 洞察提取 | analysis |
| `review-reflect` | 复盘反思 | analysis |
| `question-generator` | 问题生成器 | analysis |
| `brainstorm` | 头脑风暴 | creative |
| `story-expand` | 内容扩展 | creative |
| `writing-polish` | 文案润色 | creative |
| `title-generator` | 标题生成 | creative |

## 文件结构

```
src/services/ai/
├── index.ts          # 导出入口
├── client.ts         # AI 客户端核心
├── config.ts         # 配置管理
├── errors.ts         # 错误类型
└── prompts.ts        # Prompt 模板管理
```

## 禁止事项

⚠️ **严禁使用 mock 数据兜底**

当 AI 服务不可用时，必须：
1. 向用户显示明确的错误信息
2. 提供解决建议
3. 允许用户重试（如果错误可重试）

禁止：
- 返回预设的假数据
- 静默失败
- 隐藏错误信息

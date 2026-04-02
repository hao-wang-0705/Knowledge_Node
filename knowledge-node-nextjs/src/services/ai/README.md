# AI 服务模块

前端 AI 服务层，负责与后端 Agent 模块通信，并提供本地 Prompt 管理与 AI 客户端封装。

## 架构概览

```
前端 services/ai/          后端 modules/agent/
┌──────────────┐          ┌──────────────────┐
│  gateway.ts  │ ──API──▶ │ Agent Controller  │
│  client.ts   │          │ AI Provider 调度  │
│  prompts.ts  │          │ 结构化解析       │
│  config.ts   │          └──────────────────┘
│  errors.ts   │
└──────────────┘
```

核心 AI 能力（智能捕获、结构化、聚合等）由**后端 Agent 模块**统一调度执行，前端负责：
- 通过 `gateway.ts` 与后端 Agent API / WebSocket 通信
- 通过 `client.ts` 封装 AI 客户端调用
- 通过 `prompts.ts` 管理本地 Prompt 模板
- 通过 `config.ts` 管理 AI 配置与提供商选择
- 通过 `errors.ts` 统一错误类型与降级策略

## 文件结构

```
src/services/ai/
├── index.ts          # 导出入口
├── gateway.ts        # AI 网关：与后端 Agent API 通信
├── client.ts         # AI 客户端核心（请求封装、流式处理）
├── config.ts         # 配置管理（API Key、Provider 选择）
├── errors.ts         # 错误类型定义（AIServiceError、错误码）
└── prompts.ts        # Prompt 模板集中管理
```

## API 端点

前端通过 `src/app/api/ai/` 路由代理转发至后端 Agent：

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/ai/status` | AI 服务状态与配置检查 |
| POST | `/api/ai/aggregate` | 聚合多节点内容 |
| POST | `/api/ai/capture` | 内容捕获 |
| POST | `/api/ai/smart-capture` | 智能捕获（含结构化） |
| POST | `/api/ai/smart-structure` | 智能结构化 |
| POST | `/api/ai/quick-action` | 快捷操作 |
| POST | `/api/ai/search-nl-parse` | 自然语言解析为搜索条件 |
| POST | `/api/ai/should-suggest-deconstruct` | 判断是否建议解构 |
| POST | `/api/ai/image-recognize` | 图像识别 |
| POST | `/api/ai/voice-recognize` | 语音识别 |
| POST/GET | `/api/ai/transcribe` | 转写 |
| POST | `/api/ai/command` | AI 指令执行 |
| POST | `/api/ai/field` | AI 字段处理 |
| POST | `/api/ai/format-notes` | 笔记格式化 |

## 错误处理

所有 AI 错误统一抛出 `AIServiceError`，包含错误码、人类可读消息和重试建议：

| 错误码 | 说明 |
|--------|------|
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

## 降级策略

当 AI 服务不可用时：
1. 向用户展示明确的错误信息与解决建议
2. 支持可重试错误的自动/手动重试
3. **严禁使用 mock 数据兜底或静默失败**

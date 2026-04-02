# Nexus 前端 (knowledge-node-nextjs)

> Nexus 知识操作系统的前端应用，基于 Next.js 16 + React 19 构建。

## 技术栈

| 分类 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) + React 19 |
| 语言 | TypeScript 5 |
| 状态管理 | Zustand 5 |
| UI 组件 | Radix UI (Headless) + Shadcn UI |
| 样式 | Tailwind CSS 4 |
| 编辑器 | Lexical |
| 拖拽 | @dnd-kit |
| 图可视化 | React Flow / XYFlow |
| 数据请求 | TanStack React Query |
| 表单 | React Hook Form + Zod |
| ORM | Prisma (与后端共享 Schema) |
| 测试 | Vitest + Testing Library + Playwright |

## 快速开始

```bash
# 安装依赖
npm install

# 复制环境配置
cp .env.example .env.local

# 启动开发服务器（需先启动后端与数据库）
npm run dev
```

前端默认运行在 http://localhost:3000

## 常用命令

```bash
npm run dev           # 开发模式
npm run build         # 构建生产版本
npm run start         # 启动生产服务器
npm run lint          # ESLint 检查
npm run test          # 运行单元测试 (Vitest)
npm run test:watch    # 监听模式测试
npm run test:e2e      # 端到端测试 (Playwright)
npm run db:generate   # 生成 Prisma Client
npm run db:migrate    # 开发环境数据库迁移
npm run db:studio     # Prisma Studio 可视化管理
```

## 项目结构

```
src/
├── app/                        # Next.js App Router 路由与 API Routes
│   └── api/ai/                 # AI 相关 API 路由（代理转发至后端）
├── components/                 # React 组件（按领域分组）
│   ├── node/                   # 节点渲染与交互
│   ├── editor/                 # 编辑器外壳与命令中心
│   ├── sidebar/                # 导航侧边栏
│   ├── tag-library/            # 超级标签管理面板
│   ├── capture/                # 快速捕获流程
│   ├── search-node/            # 搜索节点与查询构建器
│   ├── pinned-view/            # 固定视图与超级标签聚合仪表盘
│   ├── supertag-focus/         # 超级标签聚焦页面
│   ├── split-pane/             # 详情面板与分栏适配
│   ├── layout/                 # 全局布局与顶部导航
│   ├── auth/                   # 认证表单
│   └── ui/                     # 可复用基础 UI 组件 (Shadcn)
├── hooks/                      # 自定义 Hooks
├── stores/                     # Zustand 全局状态管理
├── services/                   # 服务层
│   ├── ai/                     # AI 服务模块（客户端接口）
│   ├── agent/                  # Agent 服务（与后端 Agent 通信）
│   ├── api/                    # API 客户端
│   └── server/                 # 服务端 Action
├── lib/                        # 工具库
├── schemas/                    # Zod 验证 Schema
├── types/                      # TypeScript 类型定义
├── contexts/                   # React Context
├── styles/                     # 全局样式
└── utils/                      # 工具函数
```

## 核心功能模块

- **大纲编辑器**：无限层级节点编辑，支持拖拽排序、缩进、折叠展开
- **超级标签 (Supertag)**：为节点绑定类型化标签，自动展开结构化字段面板
- **搜索节点**：将查询条件保存为节点，支持自然语言解析与条件构建器
- **固定视图 (Pinned View)**：超级标签聚合仪表盘，按标签类型汇总展示节点
- **日历与每日笔记**：按年/月/周/日自动建树，快速进入当日笔记
- **引用系统**：节点间 `[[引用]]`，支持反向链接与引用预览
- **AI 能力**：智能捕获、自动结构化、聚合摘要、图像/语音识别（通过后端 Agent）
- **命令中心**：`/` 唤出命令面板，快捷操作与 AI 指令

## 与后端的关系

本前端依赖 `knowledge-node-backend` 提供的 REST API 和 WebSocket 服务。AI 能力由后端 Agent 模块统一调度，前端通过 `services/agent/` 和 `services/api/` 与之通信。

两份 Prisma Schema 需保持同步，详见根目录 README。

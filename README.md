# Nexus v4.1

Nexus 是 AI 原生的节点式知识操作系统：以树形节点组织内容，用超级标签（Supertag）赋予节点结构化属性，支持日历/每日笔记、搜索节点、固定视图仪表盘与 AI 增强的捕获、搜索与聚合。

## 技术栈

### 前端
- **框架**: Next.js 16 + React 19 + TypeScript
- **状态管理**: Zustand
- **UI**: Radix UI + Tailwind CSS
- **展示参考**: `UI_New` 为 Figma 导出的布局/视觉参考；生产前端为 `knowledge-node-nextjs`，视觉对齐见 [ADR-007](docs/ADR-007-ui-new-frontend-upgrade.md)。

### 后端
- **框架**: NestJS + TypeScript
- **ORM**: Prisma
- **数据库**: PostgreSQL 16

### 部署
- Docker + Docker Compose

## 快速开始

### 前提条件

- Node.js 20+
- Docker 与 Docker Compose
- Git

### 本地开发

#### 1. 克隆项目

```bash
git clone <repository-url>
cd Knowledge_Node
```

#### 2. 启动数据库

```bash
docker-compose up -d postgres
```

#### 3. 启动后端

```bash
cd knowledge-node-backend

npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed   # 初始化系统预设标签（Task/Meeting/Idea/Book 等）
npm run start:dev
```

后端默认：http://localhost:4000，API 文档：http://localhost:4000/api/docs

#### 4. 启动前端

```bash
cd knowledge-node-nextjs

npm install
npm run dev
```

前端默认：http://localhost:3000

### Docker 部署

```bash
cp .env.example .env
# 按需编辑 .env

docker-compose up -d --build
docker-compose logs -f   # 查看日志
docker-compose down      # 停止
```

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:3000 |
| 后端 | http://localhost:4000 |
| API 文档 | http://localhost:4000/api/docs |
| 数据库 | localhost:5432 |

### 数据库

```bash
cd knowledge-node-backend
npx prisma migrate dev    # 开发环境迁移
npx prisma studio         # 可视化管理
npx prisma migrate reset  # 重置（慎用）
```

### Prisma Schema 同步

仓库内有两份 Prisma schema：`knowledge-node-nextjs/prisma/schema.prisma` 与 `knowledge-node-backend/prisma/schema.prisma`。**修改任一份后需同步另一份**（模型与字段一致，顺序可不同）。校验：

```bash
./scripts/check-prisma-schema-sync.sh
# 或
node scripts/check-prisma-schema-sync.mjs
```

建议在 CI 中执行上述校验，不一致时令构建失败。

## 项目结构

```
Knowledge_Node/
├── knowledge-node-nextjs/    # 前端 (Next.js)
│   ├── src/
│   │   ├── app/              # 路由与 API Routes
│   │   ├── components/       # React 组件（按领域分组）
│   │   ├── hooks/            # 自定义 Hooks
│   │   ├── stores/           # Zustand 状态管理
│   │   ├── services/         # AI / Agent / API 客户端
│   │   ├── lib/              # 工具库
│   │   ├── schemas/          # Zod 验证 Schema
│   │   ├── types/            # TypeScript 类型定义
│   │   └── utils/            # 工具函数
│   ├── Dockerfile
│   └── package.json
│
├── knowledge-node-backend/   # 后端 (NestJS)
│   ├── src/
│   │   ├── modules/
│   │   │   ├── nodes/        # 节点 CRUD、树、搜索
│   │   │   ├── tags/         # 超级标签 (supertags) 与标签搜索
│   │   │   ├── edges/        # 节点间边 (CONTAINS/MENTION 等)
│   │   │   ├── users/        # 用户与初始化
│   │   │   ├── agent/        # AI Agent（捕获、结构化、聚合等）
│   │   │   └── status-machine/
│   │   └── prisma/
│   ├── prisma/schema.prisma
│   ├── Dockerfile
│   └── package.json
│
├── UI_New/                   # Figma 导出的布局/视觉参考
├── scripts/                  # 仓库级脚本（见 scripts/README.md）
├── docs/                     # ADR、PRD、设计稿 Mockups 等
├── docker-compose.yml
└── README.md
```

## API 概览

启动后端后访问 http://localhost:4000/api/docs 查看完整 Swagger 文档。

| 模块 | 路径 | 说明 |
|------|------|------|
| 节点 | `GET/POST/PUT/DELETE /api/nodes` 及子路径 | 节点 CRUD、树操作、搜索、日历初始化等 |
| 超级标签 | `GET /api/supertags` | 预设与可用标签列表（只读） |
| 标签搜索 | `GET /api/tags/search?q=` | 按关键词搜索标签 |
| 边 | `POST/GET/DELETE /api/edges` | 节点间关系（CONTAINS、MENTION 等） |
| 用户 | `/api/users` | 用户与根节点初始化 |
| Agent | `/api/agent` | AI 能力（智能捕获、结构化、聚合等），部分通过 WebSocket |

## 核心功能

- **树形节点**：无限层级、拖拽缩进、折叠展开、引用与反向引用。
- **超级标签（Supertag）**：为节点绑定类型与结构化字段（文本、数字、日期、引用等），支持默认模版与视图配置。
- **日历与每日笔记**：按年/月/周/日自动建树，快速进入当日笔记。
- **搜索节点**：将查询条件存为节点，展开时实时搜索；支持自然语言解析与条件构建器。
- **固定视图（Pinned View）**：超级标签聚合仪表盘，按标签类型汇总展示节点与 Widget。
- **超级标签聚焦**：按标签维度聚焦浏览节点，支持字段标签展示与快速捕获。
- **AI 能力**：智能捕获、自动结构化、聚合摘要、AI 字段处理、图像/语音识别等，由后端 Agent 模块统一调度。
- **边关系**：节点间 CONTAINS、MENTION 等关系，用于图谱与「被提及」等能力。
- **状态机**：节点状态流转管理（如任务进度）。


## 许可证

MIT

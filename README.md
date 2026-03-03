# Nexus

Nexus - AI-Native 节点式知识操作系统，支持树形结构笔记、双螺旋标签体系和日历/笔记本双模式。

## 技术栈

### 前端
- **框架**: Next.js 16 + React 19 + TypeScript
- **状态管理**: Zustand
- **UI 组件**: Radix UI + Tailwind CSS

### 后端
- **框架**: NestJS + TypeScript
- **ORM**: Prisma
- **数据库**: PostgreSQL 16

### 部署
- **容器化**: Docker + Docker Compose

## 快速开始

### 前提条件

- Node.js 20+
- Docker 和 Docker Compose
- Git

### 本地开发

#### 1. 克隆项目

```bash
git clone <repository-url>
cd Knowledge_Node
```

#### 2. 启动数据库

```bash
# 仅启动 PostgreSQL
docker-compose up -d postgres
```

#### 3. 启动后端

```bash
cd knowledge-node-backend

# 安装依赖
npm install

# 生成 Prisma Client
npx prisma generate

# 运行数据库迁移
npx prisma migrate dev

# 初始化系统预设标签（Task/Meeting/Idea/Book）
npm run prisma:seed

# 启动开发服务器
npm run start:dev
```

后端服务将在 http://localhost:4000 运行，API 文档在 http://localhost:4000/api/docs

#### 4. 启动前端

```bash
cd knowledge-node-nextjs

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端服务将在 http://localhost:3000 运行

### Docker 部署

#### 1. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 根据需要编辑 .env 文件
```

#### 2. 构建并启动所有服务

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

服务端口：
- **前端**: http://localhost:3000
- **后端**: http://localhost:4000
- **后端 API 文档**: http://localhost:4000/api/docs
- **数据库**: localhost:5432

### 数据库管理

```bash
# 进入后端目录
cd knowledge-node-backend

# 运行迁移
npx prisma migrate dev

# 打开 Prisma Studio（可视化数据库管理）
npx prisma studio

# 重置数据库
npx prisma migrate reset
```

### Prisma Schema 同步约定

本仓库存在两份 Prisma schema：`knowledge-node-nextjs/prisma/schema.prisma` 与 `knowledge-node-backend/prisma/schema.prisma`。**修改任意一份 schema 时，必须同步更新另一份**（模型与字段保持一致，顺序可不同）。校验方式：

```bash
# 从仓库根目录执行
./scripts/check-prisma-schema-sync.sh
# 或
node scripts/check-prisma-schema-sync.mjs
```

CI 中可加入此步骤，不一致时构建失败。

## 项目结构

```
Knowledge_Node/
├── knowledge-node-nextjs/      # 前端项目 (Next.js)
│   ├── src/
│   │   ├── app/               # 页面和路由
│   │   ├── components/        # React 组件
│   │   ├── hooks/             # 自定义 Hooks
│   │   ├── stores/            # Zustand 状态管理
│   │   ├── services/          # 服务层
│   │   │   └── api/           # API 客户端
│   │   ├── types/             # TypeScript 类型定义
│   │   └── utils/             # 工具函数
│   ├── Dockerfile
│   └── package.json
│
├── knowledge-node-backend/     # 后端项目 (NestJS)
│   ├── src/
│   │   ├── modules/           # 业务模块
│   │   │   ├── nodes/         # 节点模块
│   │   │   ├── notebooks/     # 笔记本模块
│   │   │   ├── tags/          # 标签模块
│   │   │   └── users/         # 用户模块
│   │   └── prisma/            # Prisma 服务
│   ├── prisma/
│   │   └── schema.prisma      # 数据库 Schema
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml          # Docker 编排配置
├── .env                        # 环境变量
└── README.md
```

## API 文档

启动后端服务后，访问 http://localhost:4000/api/docs 查看完整的 Swagger API 文档。

### 主要 API 端点

| 模块 | 端点 | 说明 |
|------|------|------|
| 节点 | `/api/nodes` | 节点 CRUD、树形操作、搜索 |
| 笔记本 | `/api/notebooks` | 笔记本 CRUD、复制 |
| 功能标签 | `/api/supertags` | 只读预设标签查询 |
| 上下文标签 | `/api/context-tags` | ContextTag CRUD |
| 用户 | `/api/users` | 用户管理 |

## 核心功能

- **树形结构笔记**: 支持创建、编辑、删除、缩进、折叠的树形节点管理
- **双螺旋标签体系**: 
  - Supertag (功能标签): 定义节点的属性和字段
  - ContextTag (上下文标签): 定义节点的归属和上下文
- **双模式导航**: 每日笔记（日历）/ 笔记本两种视图模式
- **日历日记**: 自动创建年/月/周/日层级的日记节点
- **笔记本管理**: 笔记本的创建、编辑、删除
- **查询面板** (v3.3 新增): 
  - 右侧常驻查询面板，支持多查询块并行
  - 基于内容和标签的节点搜索
  - 可调整面板宽度，设置自动持久化

## 许可证

MIT

# Knowledge Node 项目技术审查报告

> **审查日期**: 2026-02-27  
> **当前版本**: v2.1.0  
> **审查类型**: 全面技术审查

---

## 一、项目概述

**Knowledge Node** 是一个 AI-Native 节点式知识操作系统，将笔记的灵活性与数据库的强大功能相结合。核心理念是"万物皆节点"，通过扁平化的图状结构管理所有数据。

### 1.1 项目结构

```
Knowledge_Node/
├── knowledge-node-nextjs/      # 前端项目 (Next.js 16 + React 19)
│   ├── src/
│   │   ├── app/               # Next.js App Router (页面 + API 路由)
│   │   ├── components/        # React 组件 (60+)
│   │   ├── hooks/             # 自定义 Hooks (8+)
│   │   ├── stores/            # Zustand 状态管理 (6个)
│   │   ├── services/          # 服务层 (AI + API)
│   │   ├── lib/               # 工具库 (同步引擎等)
│   │   ├── types/             # TypeScript 类型定义
│   │   └── utils/             # 工具函数
│   └── prisma/                # Prisma Schema (前端直连)
│
├── knowledge-node-backend/     # 后端项目 (NestJS)
│   ├── src/
│   │   ├── modules/           # 业务模块
│   │   │   ├── nodes/         # 节点模块
│   │   │   ├── notebooks/     # 笔记本模块
│   │   │   ├── tags/          # 标签模块
│   │   │   └── users/         # 用户模块
│   │   └── prisma/            # Prisma 服务
│   └── prisma/                # Prisma Schema (后端)
│
├── docker-compose.yml          # Docker 编排配置
└── .cursor/rules/              # AI Agent 角色定义规则
```

---

## 二、技术栈详情

### 2.1 前端技术栈

| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **框架** | Next.js | 16.1.5 | App Router 模式 |
| **UI 库** | React | 19.2.3 | 最新版本 |
| **语言** | TypeScript | ^5 | 强类型支持 |
| **状态管理** | Zustand | ^5.0.10 | 轻量级状态管理 |
| **样式** | Tailwind CSS | ^4 | 原子化 CSS |
| **UI 组件** | Radix UI | 多个包 | 无头组件库 |
| **数据获取** | TanStack Query | ^5.80.7 | 服务端状态管理 |
| **拖拽** | dnd-kit | ^6.3.1 | 拖拽排序 |
| **图表** | Recharts | ^3.7.0 | 数据可视化 |
| **流程图** | @xyflow/react | ^12.10.0 | 节点流程图 |
| **认证** | NextAuth.js | ^4.24.11 | 身份认证 |
| **ORM** | Prisma Client | ^6.9.0 | 数据库访问 |
| **日期** | date-fns | ^4.1.0 | 日期处理 |

### 2.2 后端技术栈

| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **框架** | NestJS | ^11.1.13 | 企业级 Node.js 框架 |
| **ORM** | Prisma | ^6.19.2 | 类型安全 ORM |
| **API 文档** | Swagger | ^11.2.6 | OpenAPI 文档 |
| **验证** | class-validator | ^0.14.3 | DTO 验证 |
| **转换** | class-transformer | ^0.5.1 | 数据转换 |

### 2.3 基础设施

| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **数据库** | PostgreSQL | 16 | 主数据库 |
| **容器化** | Docker | - | 开发/部署环境 |
| **编排** | Docker Compose | - | 多服务编排 |

---

## 三、核心数据模型

### 3.1 Node (节点) - 核心实体

```typescript
interface Node {
  id: string;
  content: string;                    // 节点文本内容
  type?: NodeType;                    // 'text' | 'heading' | 'todo' | 'command' | 'daily'
  parentId: string | null;            // 父节点 ID (扁平化存储)
  childrenIds: string[];              // 子节点 ID 列表 (前端维护)
  isCollapsed: boolean;               // 折叠状态
  tags: string[];                     // 应用的标签 ID 列表
  supertagId?: string | null;         // 功能标签 ID
  fields: Record<string, any>;        // 动态字段值
  payload?: CommandConfig | DailyNotePayload | Record<string, any>;  // 扩展数据
  references?: NodeReference[];       // 独立引用列表
  createdAt: number;
  updatedAt?: number;
}
```

### 3.2 Supertag (超级标签) - Schema 定义

```typescript
interface Supertag {
  id: string;
  name: string;                       // 标签名称
  color: string;                      // 标签颜色
  icon?: string;                      // 标签图标
  fieldDefinitions: FieldDefinition[]; // 字段定义
  categoryId: string;                 // 所属分类
  isSystem?: boolean;                 // 系统标签标识
  parentId?: string | null;           // v2.1: 父标签 ID (继承)
  templateContent?: TemplateNode[];   // v2.1: 默认内容模版
  resolvedFieldDefinitions?: FieldDefinition[]; // v2.1: 合并后的字段定义
}
```

### 3.3 FieldDefinition (字段定义)

```typescript
interface FieldDefinition {
  id: string;
  key: string;                        // 字段键名
  name: string;                       // 显示名称
  type: FieldType;                    // 'text' | 'number' | 'date' | 'select' | 'reference'
  options?: string[];                 // select 类型的选项
  targetTagId?: string;               // v2.1: reference 类型的目标标签
  multiple?: boolean;                 // v2.1: 是否多选
  inherited?: boolean;                // v2.1: 是否继承字段
}
```

### 3.4 数据库 Schema (Prisma)

```prisma
model Node {
  id          String    @id @default(cuid())
  userId      String
  parentId    String?
  content     String    @default("")
  nodeType    String    @default("text")
  supertagId  String?
  payload     Json      @default("{}")
  fields      Json      @default("{}")
  sortOrder   Int       @default(0)
  isCollapsed Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  parent      Node?     @relation("NodeHierarchy", fields: [parentId], references: [id], onDelete: Cascade)
  children    Node[]    @relation("NodeHierarchy")
  supertag    Supertag? @relation(fields: [supertagId], references: [id])
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## 四、状态管理架构

### 4.1 Zustand Stores 概览

| Store | 文件 | 职责 |
|-------|------|------|
| `nodeStore` | `stores/nodeStore.ts` | 节点 CRUD、树形操作、日历管理 |
| `supertagStore` | `stores/supertagStore.ts` | 标签管理、字段定义、继承解析 |
| `notebookStore` | `stores/notebookStore.ts` | 笔记本管理 |
| `syncStore` | `stores/syncStore.ts` | 同步状态、离线队列 |
| `captureStore` | `stores/captureStore.ts` | 快速捕获状态 |
| `perspectiveStore` | `stores/perspectiveStore.ts` | 透视视图状态 |
| `splitPaneStore` | `stores/splitPaneStore.ts` | 分栏面板状态 |

### 4.2 数据流设计

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户界面层                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Sidebar    │  │  Outline    │  │ Perspective │              │
│  │  导航栏      │  │  Editor     │  │  Views      │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
└─────────┼─────────────────┼─────────────────┼────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    状态管理层 (Zustand)                          │
│  ┌───────────┐  ┌────────────┐  ┌─────────────┐                 │
│  │ nodeStore │  │supertagStore│  │ syncStore   │                 │
│  │ 节点状态   │  │  标签状态   │  │ 同步状态    │                 │
│  └─────┬─────┘  └─────┬──────┘  └──────┬──────┘                 │
└────────┼──────────────┼────────────────┼─────────────────────────┘
         │              │                │
         ▼              ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        服务层                                    │
│  ┌─────────────────┐  ┌─────────────────┐                       │
│  │   API 客户端     │  │   同步引擎       │                       │
│  │  services/api/  │  │  lib/syncEngine │                       │
│  └─────────────────┘  └─────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
         │                               │
         ▼                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js API Routes                            │
│  /api/nodes  /api/supertags  /api/notebooks  /api/ai/*          │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL 数据库                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 五、已实现功能清单

### 5.1 核心功能

| 功能模块 | 状态 | 描述 |
|---------|------|------|
| 大纲编辑器 | ✅ 完成 | 无限层级内容组织、Tab/Shift+Tab 缩进 |
| 超级标签系统 | ✅ 完成 | 带 Schema 的功能标签、动态字段 |
| 标签继承系统 | ✅ 完成 | v2.1 - 面向对象的标签继承 |
| 引用字段 | ✅ 完成 | v2.1 - reference 类型字段 |
| 默认模版 | ✅ 完成 | v2.1 - 应用标签时自动填充模版 |
| 透视视图系统 | ✅ 完成 | 5 种视图：看板/议程/卡片/流程/表格 |
| AI 指令节点 | ✅ 完成 | 12+ 预设模板、自定义 Prompt |
| 快速捕获 | ✅ 完成 | 多模态输入 + AI 结构化解析 |
| 双向链接 | ✅ 完成 | @提及 + [[双链]] + Backlinks |
| 每日笔记 | ✅ 完成 | 日历结构自动创建 (年/月/周/日) |
| 用户认证 | ✅ 完成 | NextAuth + 多用户数据隔离 |
| 笔记本管理 | ✅ 完成 | 多笔记本切换 |
| 数据同步 | ✅ 完成 | v2.1 - DB-First + 离线支持 |
| 冲突解决 | ✅ 完成 | v2.1 - 服务器优先/本地优先/智能合并 |

### 5.2 透视视图详情

| 视图类型 | 组件文件 | 功能描述 |
|---------|----------|----------|
| 看板视图 | `KanbanView.tsx` | 按状态分组的看板 |
| 议程视图 | `AgendaView.tsx` | 按时间线展示 |
| 卡片视图 | `CardView.tsx` | 卡片网格布局 |
| 流程视图 | `FlowView.tsx` | 节点关系图 |
| 表格视图 | `TableView.tsx` | 表格形式展示 |

### 5.3 AI 功能

| 功能 | 实现位置 | 描述 |
|------|----------|------|
| AI 指令节点 | `CommandNodeView.tsx` | 可配置的 AI 指令 |
| AI 网关层 | `services/ai/gateway.ts` | 统一请求入口、限流、重试 |
| Prompt 模板 | `services/ai/prompts.ts` | 预设 Prompt 模板 |
| 快速捕获 | `components/capture/` | 语音/文本 AI 结构化 |
| Schema 生成 | `/api/ai/generate-schema` | AI 生成标签 Schema |

---

## 六、API 接口清单

### 6.1 Next.js API Routes (前端)

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/nodes` | GET/POST | 获取/创建节点 |
| `/api/nodes/[id]` | GET/PUT/DELETE | 单节点操作 |
| `/api/supertags` | GET/POST | 获取/创建标签 |
| `/api/supertags/[id]` | GET/PUT/DELETE | 单标签操作 |
| `/api/notebooks` | GET/POST | 获取/创建笔记本 |
| `/api/notebooks/[id]` | GET/PUT/DELETE | 单笔记本操作 |
| `/api/categories` | GET/POST | 获取/创建分类 |
| `/api/categories/[id]` | GET/PUT/DELETE | 单分类操作 |
| `/api/settings` | GET/POST | 用户设置 |
| `/api/ai/command` | POST | AI 指令执行 |
| `/api/ai/capture` | POST | AI 快速捕获 |
| `/api/ai/transcribe` | POST | 语音转写 |
| `/api/ai/generate-schema` | POST | AI 生成 Schema |
| `/api/ai/status` | GET | AI 服务状态 |

### 6.2 NestJS API (后端)

| 模块 | 端点前缀 | 描述 |
|------|----------|------|
| Nodes | `/api/nodes` | 节点 CRUD、树形操作、搜索 |
| Notebooks | `/api/notebooks` | 笔记本 CRUD |
| Tags | `/api/supertags` | Supertag CRUD |
| Users | `/api/users` | 用户管理 |

---

## 七、组件架构

### 7.1 核心组件清单

| 组件 | 文件 | 职责 |
|------|------|------|
| `NodeComponent` | `NodeComponent.tsx` (1200+ 行) | 节点渲染、编辑、交互 |
| `OutlineEditor` | `OutlineEditor.tsx` | 大纲编辑器容器 |
| `Sidebar` | `Sidebar.tsx` | 侧边导航栏 |
| `TagLibrary` | `TagLibrary.tsx` | 标签库管理 |
| `CommandCenter` | `CommandCenter.tsx` | 命令面板 (/) |
| `FieldEditor` | `FieldEditor.tsx` | 字段编辑器 |
| `MentionPopover` | `MentionPopover.tsx` | @提及弹窗 |
| `ContextMenu` | `ContextMenu.tsx` | 右键菜单 |
| `SyncStatusIndicator` | `SyncStatusIndicator.tsx` | 同步状态指示 |
| `ConflictDialog` | `ConflictDialog.tsx` | 冲突解决对话框 |

### 7.2 UI 基础组件 (Shadcn/Radix)

```
components/ui/
├── button.tsx
├── dialog.tsx
├── dropdown-menu.tsx
├── popover.tsx
├── tooltip.tsx
├── input.tsx
├── textarea.tsx
├── badge.tsx
├── collapsible.tsx
├── hover-card.tsx
├── command.tsx
└── toast.tsx
```

---

## 八、代码质量评估

### 8.1 优点

1. **架构清晰**：遵循"万物皆节点"的核心理念，数据模型统一
2. **类型安全**：全面使用 TypeScript，类型定义完整
3. **状态管理规范**：Zustand Store 职责分离清晰
4. **同步机制完善**：离线队列、重试策略、冲突解决
5. **AI 集成规范**：网关层统一管理、限流、日志
6. **组件化良好**：UI 组件复用性高

### 8.2 待改进项

| 问题 | 优先级 | 建议 |
|------|--------|------|
| `NodeComponent.tsx` 过大 (1200+ 行) | P1 | 拆分为子组件 |
| 缺少单元测试 | P1 | 添加 Vitest 测试 |
| 前后端 Schema 存在差异 | P2 | 统一 Prisma Schema |
| 部分 API 缺少错误边界处理 | P2 | 完善错误处理 |
| 缺少 E2E 测试 | P2 | 添加 Playwright 测试 |
| 移动端适配不完善 | P3 | 响应式优化 |

### 8.3 技术债务

1. **两套 Prisma Schema**：`knowledge-node-nextjs/prisma/schema.prisma` 和 `knowledge-node-backend/prisma/schema.prisma` 存在细微差异，需要统一
2. **后端模块未完全启用**：NestJS 后端已搭建但部分功能由 Next.js API Routes 承担
3. **日历节点 ID 处理复杂**：多用户场景下的日历节点 ID 前缀逻辑较复杂

---

## 九、部署配置

### 9.1 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 | 3000 | Next.js 应用 |
| 后端 | 4000 | NestJS API |
| 数据库 | 5433 | PostgreSQL |

### 9.2 环境变量

```bash
# 数据库
DATABASE_URL="postgresql://user:password@localhost:5433/knowledge_node"

# 认证
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# AI 服务
AI_API_KEY="your-api-key"
NEXT_PUBLIC_AI_API_URL="https://api.example.com/v1"
NEXT_PUBLIC_AI_DEFAULT_MODEL="gpt-4"
```

### 9.3 启动命令

```bash
# 1. 启动数据库
docker-compose up -d postgres

# 2. 启动后端 (可选)
cd knowledge-node-backend
npm install && npx prisma migrate dev && npm run start:dev

# 3. 启动前端
cd knowledge-node-nextjs
npm install && npm run dev
```

---

## 十、后续开发建议

### 10.1 短期优化 (P1)

1. **拆分 NodeComponent**：将 1200+ 行的组件拆分为：
   - `NodeContent.tsx` - 内容编辑
   - `NodeActions.tsx` - 操作按钮
   - `NodeFields.tsx` - 字段编辑
   - `NodeReferences.tsx` - 引用管理

2. **添加测试覆盖**：
   - 使用 Vitest 添加 Store 单元测试
   - 使用 Playwright 添加 E2E 测试
   - 重点覆盖节点树操作、同步逻辑

3. **统一 Prisma Schema**：合并前后端 Schema，确保一致性

### 10.2 中期规划 (P2)

1. **性能优化**：
   - 大量节点时的虚拟滚动
   - 节点渲染优化 (React.memo 细化)
   - 数据库查询优化

2. **功能增强**：
   - 协作编辑支持
   - 更多透视视图
   - 插件系统基础

### 10.3 长期规划 (P3)

1. 移动端应用 (React Native)
2. 插件市场
3. 多语言支持

---

## 十一、文件索引

### 11.1 核心文件快速定位

| 功能 | 文件路径 |
|------|----------|
| 节点类型定义 | `knowledge-node-nextjs/src/types/index.ts` |
| 节点 Store | `knowledge-node-nextjs/src/stores/nodeStore.ts` |
| 标签 Store | `knowledge-node-nextjs/src/stores/supertagStore.ts` |
| 同步 Store | `knowledge-node-nextjs/src/stores/syncStore.ts` |
| 同步引擎 | `knowledge-node-nextjs/src/lib/syncEngine.ts` |
| AI 网关 | `knowledge-node-nextjs/src/services/ai/gateway.ts` |
| 节点组件 | `knowledge-node-nextjs/src/components/NodeComponent.tsx` |
| 大纲编辑器 | `knowledge-node-nextjs/src/components/OutlineEditor.tsx` |
| 数据库 Schema | `knowledge-node-nextjs/prisma/schema.prisma` |
| API 路由 | `knowledge-node-nextjs/src/app/api/` |

### 11.2 Agent 角色规则

| 角色 | 规则文件 |
|------|----------|
| SOP 总调度 | `.cursor/rules/Sop.mdc` |
| 架构师 | `.cursor/rules/Architect.mdc` |
| 前端专家 | `.cursor/rules/Frontend.mdc` |
| 后端专家 | `.cursor/rules/Backend.mdc` |
| UI 设计专家 | `.cursor/rules/UI.mdc` |
| 数据库专家 | `.cursor/rules/Database.mdc` |
| 测试员 | `.cursor/rules/Test.mdc` |
| AI 集成专家 | `.cursor/rules/AIEngineer.mdc` |

---

**文档版本**: v1.0  
**最后更新**: 2026-02-27  
**审查人**: SOP 总调度

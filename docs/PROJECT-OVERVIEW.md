# Knowledge Node 项目总览

> 详细项目介绍、功能清单、实现程度及方案的阶段性总结  
> 文档版本：v2.1.2 · 更新日期：2026-02-28

---

## 一、项目介绍

### 1.1 产品定位

**Knowledge Node** 是一个 AI-Native 节点式知识操作系统，将笔记的灵活性与数据库的强大功能相结合。核心理念是「万物皆节点」：所有数据抽象为扁平化的图状结构，通过 `Record<string, Node>` 字典树和 `childrenIds` 维护层级关系，拒绝物理嵌套。

### 1.2 核心价值

| 维度 | 描述 |
|------|------|
| **笔记体验** | 树形大纲、拖拽排序、即时编辑、折叠展开 |
| **结构化能力** | 超级标签（Supertag）定义 Schema，动态字段、继承、引用 |
| **视图模式** | 日历（每日笔记）/ 笔记本两种导航模式 |
| **AI 原生** | 指令节点、快速捕获、语音转写、Schema 生成 |
| **数据可靠** | DB-First 同步、离线队列、冲突解决、多用户隔离 |

### 1.3 技术架构概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         用户界面层 (UI Layer)                             │
│  Sidebar · OutlineEditor · Capture Bar · CommandCenter                    │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────┐
│                    状态管理层 (Zustand - 7 个 Store)                       │
│  nodeStore · supertagStore · syncStore · captureStore · notebookStore    │
│  notebookStore · splitPaneStore                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────┐
│                    服务层 (API Client · SyncEngine · AI)                   │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────┐
│              Next.js API Routes (/api/nodes · /api/supertags · /api/ai/*)  │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────┐
│                         PostgreSQL (Prisma ORM)                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.4 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Next.js | 16.1.5 |
| UI 库 | React | 19.2.3 |
| 语言 | TypeScript | ^5 |
| 状态管理 | Zustand | ^5.0.10 |
| 样式 | Tailwind CSS | ^4 |
| UI 组件 | Radix UI | 多包 |
| 认证 | NextAuth.js | ^4.24.11 |
| 后端 | NestJS | ^11 |
| ORM | Prisma | ^6.9 |
| 数据库 | PostgreSQL | 16 |
| 部署 | Docker Compose | - |

### 1.5 项目结构

```
Knowledge_Node/
├── knowledge-node-nextjs/      # 前端 (Next.js 16)
│   ├── src/app/               # App Router + API 路由
│   ├── src/components/        # React 组件 (60+)
│   ├── src/stores/            # Zustand 状态 (7 个)
│   ├── src/hooks/             # 自定义 Hooks (9+)
│   ├── src/services/          # AI + API 服务
│   ├── src/lib/               # 同步引擎、工具库
│   ├── src/types/             # TypeScript 类型
│   ├── src/utils/             # 工具函数
│   └── prisma/                # Prisma Schema
├── knowledge-node-backend/    # 后端 (NestJS)
│   └── src/modules/           # nodes / notebooks / tags / users
├── docs/                      # 文档与 ADR
├── scripts/                   # 校验脚本等
└── docker-compose.yml         # 三容器编排
```

---

## 二、功能清单

### 2.1 核心功能模块

| 模块 | 功能点 | 实现程度 | 说明 |
|------|--------|----------|------|
| **大纲编辑器** | 无限层级、缩进/反缩进、折叠、拖拽排序 | ✅ 100% | Tab/Shift+Tab、Enter 新建、Backspace 删除 |
| **超级标签** | 带 Schema 的功能标签、动态字段 | ✅ 100% | text/number/date/select/reference |
| **标签继承** | 父子标签、字段合并、循环检测 | ✅ 100% | v2.1 本体论升级 |
| **引用字段** | reference 类型、目标标签、单选/多选 | ✅ 100% | v2.1 强类型引用 |
| **默认模版** | 应用标签时自动填充内容 | ✅ 100% | v2.1 templateContent |
| ~~透视视图~~ | ~~看板/议程/卡片/流程/表格~~ | ❌ 已移除 | v2.1.2 清理 |
| **AI 指令节点** | 12+ 预设模板、自定义 Prompt | ✅ 100% | 可配置执行与重试 |
| **快速捕获** | 文本/语音多模态、AI 结构化 | ✅ 100% | 预览气泡确认 |
| **双向链接** | @提及、[[双链]]、Backlinks | ✅ 100% | MentionPopover、ReferenceChip |
| **每日笔记** | 年/月/周/日自动创建 | ✅ 100% | 日历结构、多用户 ID 前缀支持 |
| **用户认证** | 注册/登录、数据隔离 | ✅ 100% | NextAuth + userId 过滤 |
| **笔记本管理** | 多笔记本 CRUD、根节点关联 | ✅ 100% | notebookStore |
| **数据同步** | DB-First、离线队列、状态指示 | ✅ 100% | v2.1 syncStore + syncEngine |
| **冲突解决** | 服务器优先/本地优先/智能合并 | ✅ 100% | ConflictDialog |
| **标签库** | 标签编辑、Schema 定义、继承配置 | ✅ 100% | TagLibrary、SchemaFieldList |
| **命令面板** | / 唤起、快捷操作 | ✅ 100% | CommandCenter |
| **上下文菜单** | 删除、复制、添加子节点、@引用 | ✅ 100% | ContextMenu |

### 2.2 AI 功能明细

| 功能 | 实现位置 | 实现程度 | 描述 |
|------|----------|----------|------|
| AI 指令节点 | CommandNodeView、NodeCommand | ✅ 100% | 预设模板 + 自定义 Prompt |
| AI 网关 | services/ai/gateway.ts | ✅ 100% | 统一入口、限流、重试 |
| 快速捕获 | components/capture/ | ✅ 100% | 文本/语音 → AI 结构化 → 预览确认 |
| Schema 生成 | /api/ai/generate-schema | ✅ 100% | AI 根据描述生成字段定义 |
| 语音转写 | /api/ai/transcribe | ✅ 100% | 语音 → 文本 |
| AI 状态 | /api/ai/status | ✅ 100% | 服务可用性检测 |

### 2.3 API 接口清单

| 模块 | 端点 | 方法 | 实现程度 |
|------|------|------|----------|
| 节点 | /api/nodes | GET/POST | ✅ |
| 节点 | /api/nodes/[id] | GET/PUT/DELETE | ✅ |
| 节点 | /api/nodes/init-daily | POST | ✅ |
| 标签 | /api/supertags | GET/POST | ✅ |
| 标签 | /api/supertags/[id] | GET/PUT/DELETE | ✅ |
| 笔记本 | /api/notebooks | GET/POST | ✅ |
| 笔记本 | /api/notebooks/[id] | GET/PUT/DELETE | ✅ |
| 分类 | /api/categories | GET/POST | ✅ |
| 分类 | /api/categories/[id] | GET/PUT/DELETE | ✅ |
| 设置 | /api/settings | GET/POST | ✅ |
| 设置 | /api/settings/[key] | GET/POST/DELETE | ✅ |
| AI | /api/ai/command | POST | ✅ |
| AI | /api/ai/capture | POST | ✅ |
| AI | /api/ai/transcribe | POST | ✅ |
| AI | /api/ai/generate-schema | POST | ✅ |
| AI | /api/ai/status | GET | ✅ |
| 认证 | /api/auth/[...nextauth] | - | ✅ |
| 认证 | /api/auth/register | POST | ✅ |

---

## 三、实现程度及方案

### 3.1 数据模型

| 实体 | 方案 | 实现程度 |
|------|------|----------|
| Node | 扁平 Record + childrenIds，type 支持 text/command/daily | ✅ 100% |
| Supertag | parentId 继承、fieldDefinitions、templateContent、resolvedFieldDefinitions | ✅ 100% |
| FieldDefinition | key/name/type，reference 含 targetTagId、multiple | ✅ 100% |
| NodeReference | id/targetNodeId/title，独立于 content | ✅ 100% |
| 同步 | SyncOperation、SyncStatus、ConflictType、ConflictResolution | ✅ 100% |

### 3.2 同步与离线

| 能力 | 方案 | 实现程度 |
|------|------|----------|
| 同步策略 | DB-First：启动先读 DB，有数据则覆盖本地 | ✅ 100% |
| 离线队列 | syncStore 维护 pending 队列，网络恢复后 processQueue | ✅ 100% |
| 状态流转 | idle → syncing → synced / error / offline | ✅ 100% |
| 冲突检测 | 版本号/时间戳比较，ConflictDialog 三选项 | ✅ 100% |
| 冲突解决 | 服务器优先、本地优先、智能合并（字段级） | ✅ 100% |

### 3.3 认证与安全

| 能力 | 方案 | 实现程度 |
|------|------|----------|
| 认证 | NextAuth Credentials + bcrypt | ✅ 100% |
| 会话 | JWT，proxy 层校验 | ✅ 100% |
| 数据隔离 | 所有 API 按 userId 过滤 | ✅ 100% |
| 401/404 契约 | { success, error, code? } 统一结构 | ✅ 100% |

### 3.4 日历与多用户

| 能力 | 方案 | 实现程度 |
|------|------|----------|
| 日历节点 ID | year-/month-/week-/day- 确定性 ID | ✅ 100% |
| 多用户前缀 | utils/calendarNodeId 解析 prefix_originalId | ✅ 100% |
| 映射管理 | findCalendarNodeActualId、initCalendarNodeIdMap | ✅ 100% |

### 3.5 质量与测试

| 类型 | 方案 | 实现程度 |
|------|------|----------|
| 单测 | Vitest，nodeStore/syncStore/supertagStore/calendarNodeId/syncEngine | ✅ 31 用例 |
| E2E | Playwright，api-auth-401、api-error-structure、basic-flow、nodes-crud、sync-smoke、tags-node-link | ✅ 6 用例 |
| 构建 | 系统字体栈（无外网）、proxy 替代 middleware | ✅ 断网可构建 |
| Schema 校验 | scripts/check-prisma-schema-sync.sh | ✅ 双 schema 一致 |

---

## 四、阶段性总结

### 4.1 版本里程碑

| 版本 | 主题 | 完成项 | 日期 |
|------|------|--------|------|
| v2.1.0 | 本体论 + 数据同步 | 标签继承、引用字段、默认模版、DB-First、离线队列、冲突解决 | 2026-02-27 |
| v2.1.1 | 发布门禁达标 | 核心链路稳定、E2E、数据库迁移、部署配置 | 2026-02-28 |
| v2.1.2 | 技术债与残余风险治理 | R1/R2 消除、404 契约、清单收口、Schema 校验、useNodeCommand、calendarNodeId | 2026-02-28 |

### 4.2 v2.1.2 治理项摘要

| 类别 | 治理项 | 结果 |
|------|--------|------|
| 残余风险 | R1 middleware→proxy | proxy.ts 替代，Next 16 约定 |
| 残余风险 | R2 外网字体 | 系统字体栈，断网可构建 |
| API 契约 | 404/500 统一结构 | E2E 覆盖，{ success, error, code? } |
| 回归清单 | 冲突、字段渲染、冒烟 | 类型契约 + 单测 + E2E 覆盖 |
| 技术债 | 双 Prisma Schema | check-prisma-schema-sync 脚本 |
| 技术债 | NodeComponent | useNodeCommand 抽取，965→877 行 |
| 技术债 | 日历节点 ID | calendarNodeId.ts + 10 单测 + ADR-003 |

### 4.3 架构决策记录 (ADR)

| ADR | 主题 | 状态 |
|-----|------|------|
| ADR-002 | 后端 API 边界策略（Next.js 短期主入口、NestJS 中期迁移） | Accepted |
| ADR-003 | 日历节点多用户 ID 前缀策略与解析约定 | Accepted |

### 4.4 当前质量状态

| 指标 | 数值 |
|------|------|
| 单测通过 | 31/31 |
| E2E 覆盖 | 6 用例（401、404、冒烟、CRUD、同步、标签） |
| 构建 | 成功，无外网依赖 |
| Docker 部署 | 三容器（frontend/backend/postgres）可启动 |
| 回归清单 | 核心项全勾选 |

### 4.5 待优化项（非阻塞）

| 项 | 优先级 | 说明 |
|----|--------|------|
| NodeComponent 继续瘦身 | P2 | 目标 ~600 行，可再抽 useNodeTagSelector 等 |
| 移动端适配 | P2 | 部分组件待优化 |
| 大量节点性能 | P2 | 虚拟滚动等 |
| 协作编辑 | P3 | 远期规划 |
| 插件系统 | P3 | 远期规划 |

---

## 五、部署与访问

| 环境 | 方式 | 访问 |
|------|------|------|
| 本地 Docker | docker compose up -d --build | 前端 http://localhost:3000，API 文档 http://localhost:4000/api/docs |
| 开发模式 | npm run dev（前后端分别启动） | 前端 3000，后端 4000 |

---

*文档维护：SOP Review · 2026-02-28*

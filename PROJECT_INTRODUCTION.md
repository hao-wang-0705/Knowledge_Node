# Nexus 项目介绍

> 面向新加入研发的完整项目说明文档  
> 涵盖底层逻辑与愿景、用户价值、产品核心功能、技术栈与架构。

---

## 一、项目底层逻辑与愿景

### 1.1 产品定位

**Nexus** 是 AI 原生的节点式知识操作系统：以树形节点组织内容，用超级标签（Supertag）赋予节点结构化属性，支持日历/每日笔记与 AI 增强的捕获、搜索与聚合。

### 1.2 核心架构哲学

#### 万物皆节点 (Everything is a Node)

- 系统将所有数据抽象为**扁平化的图结构**。
- 每个实体都是一条**节点（Node）**记录，通过 ID 引用和边关系组成树与图谱。
- **禁止在数据模型中物理嵌套对象**（例如把子节点直接塞进父节点的 JSON 里）。层级关系通过**平级的 `Record<string, Node>` 字典 + `childrenIds` 数组**维护。

#### 树与边的表达方式

- **树形结构**：由节点的 `parentId`、`childrenIds` 与后端 **CONTAINS 边**共同表达。读树时以后端 CONTAINS 边为权威，保证多端一致。
- **图谱边（NetworkEdge）**：节点间多对多有向关系，支持四种类型：
  - **CONTAINS**：大纲父子（谁包含谁）
  - **BLOCKS**：阻塞关系（执行先决，如任务依赖）
  - **RESOLVES**：解决关系（如灵感→卡点）
  - **MENTION**：提及关系（内容/字段中引用另一节点，用于「被提及」、反向链接）

#### 元数据驱动

- 节点的「类型」与结构化属性通过 **Tag（Supertag）** 和 **Field** 解耦实现。
- 标签由系统预置（只读），用户为节点绑定标签后，可填写该标签定义的字段（文本、数字、日期、引用等），实现多维度的元数据管理。

### 1.3 数据流向原则

- **单向数据流**：前端从全局 Store（Zustand）读取扁平节点数据，用户操作通过 Action 派发，由 Store 与同步引擎与后端通信。
- **后端为权威**：持久化与图计算（子树、边、搜索）以后端/数据库为准；前端负责展示与乐观更新，冲突时以服务端为准。

---

## 二、用户价值

本节从**终端用户**视角说明 Nexus 为谁服务、解决什么问题、带来什么收益，便于研发理解「功能背后的为什么」。

### 2.1 为谁创造价值

- **知识工作者**：需要把碎片信息（会议纪要、灵感、待办、阅读笔记）统一收纳、可检索、可关联的人。
- **个人与小型团队**：希望用一套系统同时管理笔记、任务、日历与思考，减少在多个工具间切换。
- **重视结构与关联的用户**：不满足于扁平列表，希望用树形大纲、标签、引用与依赖关系表达「谁包含谁、谁依赖谁、谁提到了谁」。

### 2.2 解决什么问题

- **信息孤岛**：笔记、任务、想法散落在不同应用里，难以在一个地方看到全景。Nexus 用「万物皆节点」把笔记、任务、会议、灵感、卡点都放在同一棵树上，通过标签与边关系区分类型与关联。
- **从乱写到结构化的鸿沟**：很多人习惯先随手记再整理，但整理成本高、容易放弃。AI 捕获、智能解构、自动打标签与字段，帮助用户「先记下来，再一键变成结构」，降低从非结构化到结构化的门槛。
- **任务与阻塞不可见**：待办之间常有依赖（A 没做完 B 做不了），若没有显式建模，容易误判「可做」、漏掉阻塞。BLOCKS 边与状态机让依赖可见、被阻塞的 todo 无法被误闭环，解除前置后自动变为可执行。
- **找不到与重复劳动**：记过的东西想用时找不到，或要反复查多个地方。搜索节点 + 自然语言解析把「查询」挂在树里、随时展开看最新结果；反向链接（被谁提及）让引用关系可追溯，减少重复造轮子。
- **晨会/复盘准备费时**：站会前要自己翻任务列表、总结进展与风险。标签聚焦页的 AI 聚合（如站会播报）按条件拉取任务并生成高优预警、进展摘要、阻塞风险，用一份播报替代手动翻页。

### 2.3 带来的核心收益

- **一个地方搞定记、理、查、做**：树形笔记 + 超级标签 + 日历 + 任务看板 + 搜索与引用，在同一套数据上完成记录、整理、检索与执行，减少工具切换与数据搬运。
- **结构随用随长**：不必一开始就设计完美分类，先用树和标签记，需要时用 AI 解构、打标签、建依赖，结构随使用自然生长。
- **依赖与阻塞可见、可执行**：BLOCKS/RESOLVES 让「谁卡谁、谁解决谁」显式存在；被阻塞的 todo 状态明确、不能误闭环，前置解除后自动恢复，减少误判与遗漏。
- **AI 省时间而非制造负担**：捕获、解构、扩写、站会播报等都可按需触发，结果可预览、可编辑，用户保持最终控制权，AI 负责把「从零到一」的整理与总结成本压下去。
- **场景化工作台**：按标签进入的聚焦页（如任务看板 + 站会播报）把「看什么、怎么操作、播报什么」打包成场景，无需离开主树即可完成晨会准备与任务流转。

---

## 三、产品核心功能介绍

### 3.1 树形节点

- **无限层级**：支持多级嵌套，拖拽缩进/反缩进（Tab / Shift+Tab）调整层级。
- **折叠/展开**：按视图（如主树、搜索树）维护折叠状态，支持局部展开查看。
- **引用与反向引用**：节点可引用其他节点（独立于正文的 `references`），并展示「被谁提及」的反向链接（见 [3.7 边关系详解](#37-边关系详解) 中的 MENTION）。

### 3.2 超级标签（Supertag）

- **系统预置标签**：Task、Meeting、Idea、Book、卡点、灵感、todo 等由系统预置，用户端只读。
- **结构化字段**：每个标签带有 `fieldDefinitions`（文本、数字、日期、引用、状态等），节点绑定标签后可填写对应字段。
- **默认模版**：标签可配置 `templateContent`，新建带该标签的节点时自动生成默认子节点或字段值。
- **状态机**：部分标签（如 #todo、#卡点）配有状态机（statusConfig），驱动状态流转与边语义（如 BLOCKS 是否「已解除」）。
- 详见 [系统预置标签指南](docs/SYSTEM_PRESET_TAGS_GUIDE.md)。

### 3.3 日历与每日笔记

- **层级结构**：`daily_root` → 年（year）→ 周（week）→ 日（day），无 month 层；使用确定性 ID（如 `year-2026`、`week-2026-W12`、`day-2026-03-16`），便于按日期快速定位。
- **初始化**：用户首次使用时可调用「初始化每日笔记」，创建当日所在的年/周/日节点；之后可按需自动创建当天日笔记节点。
- **日节点**：每个 day 节点携带 `payload`（level、year、month、week、dateString 等），用于日历视图与「今日笔记」入口。
- **产品价值**：快速进入当日笔记、按周/年浏览历史日记。

### 3.4 搜索节点

- **查询即节点**：将搜索条件存为一种特殊节点（`SearchConfig`），展开该节点时实时请求后端执行搜索，结果以子树或列表形式展示。
- **条件类型**：支持按标签（tag）、字段（field）、关键词（keyword）、祖先（ancestor）、日期（date）等组合查询，逻辑运算符为 AND/OR。
- **自然语言解析**：用户输入自然语言（如「本周未完成的任务」），由后端/Agent 解析为结构化 `SearchConfig`，并返回解释与置信度；低置信度时可提示用户确认。
- **产品价值**：把「搜索」当作一等公民挂在树里，随时展开即可看到最新结果，无需离开当前上下文。

### 3.5 AI 能力

- **Agent 架构**：后端统一入口（AgentGateway）→ 意图分析（IntentAnalyzer）→ 计划生成（PlanGenerator）→ 链式执行（ChainExecutor）→ 工具（ToolRegistry）。新 AI 功能接入规范见后端 [Agent 架构接入指引](knowledge-node-backend/src/modules/agent/AGENT_GUIDE.md)。
- **典型工具**：
  - **智能捕获（Capture）**：将非结构化输入整理为节点或带标签的结构。
  - **自动结构化（Smart Structure）**：对长文本做结构化解析，挂载标签与字段。
  - **聚合摘要（Aggregate）**：按查询条件拉取节点列表，用大模型生成摘要/站会播报等（用于标签聚焦页顶栏「站会播报」等）。
  - **智能扩写（Expand）**：节点级快捷动作，将简短内容扩写为更完整表述。
  - **智能解构（Deconstruct）**：节点级快捷动作，将长文本拆成层级化子节点树并挂载标签与字段（支持幽灵预览后确认）。
  - **图像/语音识别**：多模态输入转文本或节点。
  - **自然语言搜索解析**：见 2.4。
- **产品价值**：从输入到结构的一键转化、按场景的聚合播报、节点级「扩写/解构」提升编辑效率。

### 3.6 标签聚焦页（Supertag Pinned View）

- **概念**：按某个超级标签（如 #任务）进入的「样板间」视图，用声明式配置（ViewConfig）驱动布局与组件，与主树隔离。
- **布局**：支持看板（kanban）、表格（table）、列表（list）；看板可按标签的某字段（如 `task_status`）分组，卡片支持拖拽改状态并配置允许的状态流转（allowedTransitions）。
- **组件**：
  - **顶栏 AI 聚合**：如「站会播报」，按过滤条件拉取节点，用 Prompt 生成高优预警、进展摘要、阻塞风险等，支持缓存与节点引用链接。
  - **统计栏**：按字段做 count/sum 等统计。
- **快捷操作**：Quick Capture（快速添加带默认字段的节点）、拖拽改状态（带防抖与状态机校验）。
- **产品价值**：以「任务看板 + 站会播报」为代表的场景化工作台，无需跳出主树即可做任务管理与晨会准备。

### 3.7 边关系详解

四种边类型在**产品上能做什么**、**约束**与**前后端行为**如下。

#### CONTAINS（包含）

- **含义**：表达大纲/树的父子关系——source 包含 target，即 target 是 source 的子节点。
- **能干什么**：读树时以 CONTAINS 边为权威，前端展示层级、缩进、折叠；写树时通过 CONTAINS 建边/删边完成移动、挂子节点等。后端在写 CONTAINS 时会做**防环检查**（source 的祖先链不能包含 target）。
- **约束**：一对父子在同一时刻只应有一条 CONTAINS 入边（target 只有一个父节点）；树结构由 CONTAINS + Node.sortOrder 共同表达。

#### BLOCKS（阻塞）

- **含义**：source 阻塞 target，即「target 依赖 source 先完成」；用于任务依赖、卡点阻塞待办等。
- **能干什么**：
  - **任务依赖**：当 target 是 #todo 节点时，若存在「未解除」的 BLOCKS 前置（即 source 是 #卡点 且未到 Resolved，或是 #todo 且未到 Done），则 target 会被置为**阻塞态（如 Locked）**，前端展示「被 N 个前置阻塞」及前置内容摘要；用户**不能直接把该 todo 闭环为 Done**，必须先解除前置（把卡点标为已解决或把前置 todo 标为完成）。
  - **自动状态推导**：后端根据 BLOCKS 入边与前置节点状态，统一重算 target 的 `todo_status`（或标签配置的状态字段）：有未解除前置 → Locked；全部解除或无前置 → 可恢复为 Ready 等可执行态。
- **约束**：BLOCKS 的 **source 只能是 #卡点 或 #todo**，**target 只能是 #todo**；由状态机配置判定「已解除」（卡点 Resolved、todo Done）。

#### RESOLVES（解决）

- **含义**：source 解决了 target，即「某个灵感/方案解决了某个卡点」。
- **能干什么**：建立 #灵感 与 #卡点 之间的关联，便于回溯「这个卡点被哪些灵感覆盖」；与 BLOCKS 配合时，卡点被标为 Resolved 后，被该卡点 BLOCKS 的 todo 可自动变为可执行态。
- **约束**：RESOLVES 的 **source 只能是 #灵感**，**target 只能是 #卡点**。

#### MENTION（提及）

- **含义**：source 在内容或字段中引用了 target，即「source 提及了 target」。
- **能干什么**：
  - **反向链接（Backlinks）**：查询「谁提到了当前节点」——API `GET /api/nodes/:id/mentioned-by` 返回所有通过 MENTION 指向该节点的 source，以及来源类型（正文提及 / 某字段引用）；前端在节点详情或侧栏展示「被提及于 N 个节点」列表，可点击跳转。
  - **数据来源**：MENTION 边由后端根据节点的 `references` 与字段中的 `nodeId` 自动同步（先删后建），无需用户手动建边。
- **约束**：仅表示引用关系，不参与状态机；用于知识图谱、反向链接与「被谁引用」能力。

---

## 四、产品技术栈介绍

### 4.1 前端 (knowledge-node-nextjs)

| 类别       | 技术选型 | 说明 |
|------------|----------|------|
| 框架       | Next.js 16 + React 19 + TypeScript | App Router，服务端与客户端组件 |
| 状态管理   | Zustand | 节点树、标签、同步、捕获等 Store |
| UI 基础    | Radix UI + Tailwind CSS | 无头组件 + 原子化样式 |
| 富文本     | Lexical | 节点正文与内联编辑 |
| 拖拽       | @dnd-kit (core / sortable / utilities) | 节点拖拽排序与层级 |
| 图谱       | @xyflow/react | 图谱可视化（如需要） |
| 命令面板   | cmdk | 快捷命令与搜索 |
| 表单/校验  | react-hook-form + @hookform/resolvers | 表单与校验 |
| 日期       | date-fns + react-day-picker | 日历与日期字段 |
| 测试       | Vitest（单元）、Playwright（E2E） | 前端自动化测试 |

- **数据流**：组件从 Store 只读；用户操作 → Store Action → 同步引擎（syncEngine）→ 后端 API；乐观更新 + 服务端合并。
- **类型**：核心实体（Node、TagTemplate、边、同步操作等）在 `src/types` 定义，与后端契约对齐。

### 4.2 后端 (knowledge-node-backend)

| 类别       | 技术选型 | 说明 |
|------------|----------|------|
| 框架       | NestJS + TypeScript | 模块化 API 与 WebSocket |
| ORM        | Prisma | 模型定义、迁移、查询 |
| 数据库     | PostgreSQL 16 | 主库 |
| 文档       | Swagger (OpenAPI) | 由 @nestjs/swagger 生成，`/api/docs` |
| AI 集成    | OpenAI SDK 等 | Agent 工具内调用大模型 |

- **核心模块**：`nodes`（CRUD、树、搜索）、`tags`（超级标签只读）、`edges`（边 CRUD、CONTAINS 读树）、`users`、`agent`（AI 能力）、`status-machine`（状态机，如需要）。
- **树与边**：树结构由 CONTAINS 边 + Node 的 `sortOrder` 等表达；写树时防环、先删后建 CONTAINS；MENTION 由内容解析后同步。

### 4.3 数据库与 Schema

- **Prisma**：`knowledge-node-backend/prisma/schema.prisma` 为后端权威；`knowledge-node-nextjs/prisma/schema.prisma` 需与后端**保持模型与字段一致**（可运行仓库内 schema 同步校验脚本）。
- **核心表**：`users`、`nodes`、`network_edges`、`tag_templates`、`user_tag_library` 等；Node 含 `logicalId`（业务唯一）、`userId`、`parentId`、`supertagId`、`payload`、`fields`、`tags`、`references`、`sortOrder` 等。

### 4.4 部署与开发环境

- **本地**：Node.js 20+；PostgreSQL 用 Docker 启动（`docker-compose up -d postgres`）；后端 `npm run start:dev`（默认 4000）；前端 `npm run dev`（默认 3000）。
- **全量部署**：Docker Compose 构建并启动前端、后端、数据库；环境变量见 `.env.example`。
- **数据库迁移**：在 `knowledge-node-backend` 下执行 `npx prisma migrate dev` / `npx prisma migrate deploy`；种子数据（预设标签）通过 `npm run prisma:seed` 初始化。

---

## 五、仓库结构速览

```
Knowledge_Node/
├── knowledge-node-nextjs/     # 前端
│   ├── src/
│   │   ├── app/               # 路由与 API Routes（代理等）
│   │   ├── components/        # React 组件（编辑器、节点、侧栏、命令中心等）
│   │   ├── hooks/             # 业务 Hooks
│   │   ├── stores/            # Zustand Store（节点、标签、同步、捕获等）
│   │   ├── services/          # AI 与 API 客户端
│   │   ├── types/             # 类型与契约
│   │   └── lib/               # 同步引擎、工具函数等
│   └── prisma/                # 与后端对齐的 Schema（只读/生成客户端）
│
├── knowledge-node-backend/    # 后端
│   ├── src/
│   │   ├── modules/           # nodes, tags, edges, users, agent, status-machine
│   │   └── app.module.ts
│   └── prisma/                # 权威 Schema、迁移、种子
│
├── docs/                      # 文档（本文档、ADR、产品说明等）
├── scripts/                   # 仓库级脚本（如 Prisma 双端校验）
├── docker-compose.yml
└── README.md
```

---

## 六、新成员上手建议

1. **先读**：本文档 + [README.md](README.md) 的快速开始与项目结构。
2. **理解数据**：看 `knowledge-node-nextjs/src/types/index.ts` 中的 `Node`、`TagTemplate` 等，以及 `knowledge-node-backend/prisma/schema.prisma` 中的模型与 `NetworkEdge` 枚举。
3. **跑通本地**：按 README 启动数据库 → 后端 → 前端，访问 3000/4000 与 `/api/docs`。
4. **按领域深入**：树与同步 → `nodeStore` + `syncEngine` + 后端 `nodes`/`edges`；标签 → `tags` 模块与 SYSTEM_PRESET_TAGS_GUIDE；AI → `agent` 模块与 AGENT_GUIDE。
5. **修改 Schema 时**：先与团队/架构约定，再改后端 Prisma 并同步前端 schema，跑迁移与种子。

---

*文档维护：随架构与功能演进更新。若与代码不一致，以代码与 ADR 为准。*

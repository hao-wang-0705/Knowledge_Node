# Knowledge Node v3.0 阶段性里程碑报告

> **版本**: v3.0.0  
> **报告日期**: 2026-03-02  
> **文档类型**: 项目阶段性里程碑分析报告

---

## 📋 执行摘要

**Knowledge Node** 是一个 AI-Native 节点式知识操作系统，将笔记的灵活性与数据库的强大功能相结合。v3.0 版本作为重大里程碑，在 v2.1.x 基础上完成了**统一树结构契约**、**双栈 API 统一化**和**系统架构优化**三大核心升级。

### 里程碑达成概览

| 里程碑 | 状态 | 完成度 | 说明 |
|--------|------|--------|------|
| 统一树结构契约 (ADR-005) | ✅ 完成 | 100% | user_root + daily_root 双根设计 |
| 双栈 API 统一 (ADR-006) | ✅ 完成 | 100% | 后端 SSOT，前端转发 |
| 数据库迁移完成 | ✅ 完成 | 100% | 8 次迁移，scope/notebookId 收敛 |
| 代码质量治理 | ✅ 完成 | 100% | 31 单测 + 6 E2E 用例 |
| Docker 三容器部署 | ✅ 完成 | 100% | frontend + backend + postgres |

---

## 一、技术栈架构

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户界面层 (UI Layer)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Sidebar   │  │  Outline    │  │   Capture   │  │  Command    │        │
│  │   导航栏     │  │   Editor    │  │    Bar      │  │   Center    │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
└─────────┼─────────────────┼─────────────────┼─────────────────┼─────────────┘
          │                 │                 │                 │
          ▼                 ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      状态管理层 (Zustand Stores - 7个)                        │
│  ┌───────────┐  ┌────────────┐  ┌─────────────┐  ┌──────────────┐          │
│  │ nodeStore │  │supertagStore│  │  syncStore  │  │captureStore  │          │
│  │ ~1175行   │  │   ~715行    │  │   ~550行    │  │  捕获状态     │          │
│  └─────┬─────┘  └──────┬─────┘  └──────┬──────┘  └──────┬───────┘          │
│  ┌───────────┐  ┌────────────┐  ┌─────────────┐                            │
│  │notebookSt.│  │splitPaneSt.│  │perspectiveSt│                            │
│  └───────────┘  └────────────┘  └─────────────┘                            │
└────────┼──────────────┼────────────────┼───────────────────────────────────┘
         │              │                │
         ▼              ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           服务层 (Service Layer)                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   API 客户端     │  │   同步引擎       │  │   AI 服务模块    │             │
│  │ services/api/   │  │ lib/syncEngine  │  │  services/ai/   │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Next.js API Routes (转发层)                               │
│  /api/nodes  /api/supertags  /api/notebooks  /api/categories  /api/ai/*    │
│  [职责: NextAuth 会话校验 → x-user-id 注入 → 转发后端 → 响应适配]             │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ HTTP Proxy
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      NestJS 后端 (业务 SSOT)                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Nodes     │  │    Tags     │  │  Notebooks  │  │    Users    │        │
│  │   Module    │  │   Module    │  │   Module    │  │   Module    │        │
│  │  ~530行     │  │  ~232行     │  │   待扩展     │  │   ~118行    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ Prisma ORM
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PostgreSQL 16 数据库                                  │
│  [User] [Node] [Supertag] [Category] [UserSetting]                          │
│  统一树结构：user_root ← 普通节点 / daily_root ← 日历节点                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 技术栈明细

#### 前端技术栈

| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **框架** | Next.js | 16.1.5 | App Router 模式 |
| **UI 库** | React | 19.2.3 | 最新 Concurrent 特性 |
| **语言** | TypeScript | ^5 | 全面类型覆盖 |
| **状态管理** | Zustand | ^5.0.10 | 轻量级状态管理 |
| **数据获取** | TanStack Query | ^5.80.7 | 服务端状态缓存 |
| **样式** | Tailwind CSS | ^4 | 原子化 CSS + CSS 变量 |
| **UI 组件** | Radix UI | 多包 | 无障碍基础组件 |
| **拖拽** | @dnd-kit | ^6.3.1 | 拖拽排序 |
| **图标** | Lucide React | - | SVG 图标库 |
| **认证** | NextAuth.js | ^4.24.11 | 身份认证 |
| **表单** | react-hook-form + zod | - | 表单验证 |
| **日期** | date-fns | ^4.1.0 | 日期处理 |
| **图表** | Recharts | ^3.7.0 | 数据可视化 |
| **命令面板** | cmdk | - | ⌘+K 命令面板 |

#### 后端技术栈

| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **框架** | NestJS | ^11.1.13 | 企业级 Node.js 框架 |
| **ORM** | Prisma | ^6.19.2 | 类型安全 ORM |
| **语言** | TypeScript | ^5.9.3 | 强类型支持 |
| **API 文档** | @nestjs/swagger | ^11.2.6 | OpenAPI 自动生成 |
| **验证** | class-validator | ^0.14.3 | DTO 装饰器验证 |
| **转换** | class-transformer | ^0.5.1 | 数据序列化 |
| **测试** | Jest | ^30.2.0 | 单元测试框架 |

#### 基础设施

| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **数据库** | PostgreSQL | 16-alpine | 主数据库 |
| **容器化** | Docker | - | 开发/生产环境 |
| **编排** | Docker Compose | 3.x | 三容器编排 |
| **构建** | 多阶段 Dockerfile | - | 优化镜像体积 |

---

## 二、核心功能实现思路与逻辑

### 2.1 统一树结构设计 (ADR-005)

#### 设计理念
采用「万物皆节点」的核心理念，所有数据抽象为扁平化的图状结构，通过 `Record<string, Node>` 字典树和 `childrenIds` 维护层级关系。

#### 树结构约定

```
                          [数据库根]
                              │
              ┌───────────────┴───────────────┐
              │                               │
         [user_root]                     [daily_root]
         nodeRole=user_root              nodeRole=daily_root
              │                               │
    ┌─────────┴─────────┐          ┌─────────┴─────────┐
    │                   │          │                   │
[笔记本1]           [笔记本2]    [year-2026]       [year-2025]
    │                   │          │
    ▼                   ▼          ▼
 普通节点            普通节点    [week-2026-W09]
                                   │
                                   ▼
                              [day-2026-03-02]
```

#### 核心约束
1. **user_root**: 用户笔记本根节点，`nodeRole='user_root'`，禁止删除/移动
2. **daily_root**: 每日笔记根节点，`nodeRole='daily_root'`，禁止删除/移动
3. **循环检测**: 节点移动时遍历祖先链，防止形成循环引用
4. **级联删除**: 删除父节点时自动删除所有子孙节点

#### 实现代码（后端 NodesService）

```typescript
// 确保用户结构根节点存在
private async ensureStructuralRoots(userId: string) {
  const userRoot = await this.prisma.node.upsert({
    where: { id: `${userId}_user_root` },
    update: {},
    create: {
      id: `${userId}_user_root`,
      userId,
      nodeType: 'root',
      nodeRole: 'user_root',
      content: 'User Root',
    },
  });
  
  const dailyRoot = await this.prisma.node.upsert({
    where: { id: `${userId}_daily_root` },
    update: {},
    create: {
      id: `${userId}_daily_root`,
      userId,
      nodeType: 'root',
      nodeRole: 'daily_root',
      content: 'Daily Root',
      parentId: userRoot.id,
    },
  });
  
  return { userRoot, dailyRoot };
}

// 循环引用检测
private async assertNoCycle(userId: string, nodeId: string, newParentId: string | null) {
  if (!newParentId) return;
  let current = await this.prisma.node.findUnique({ where: { id: newParentId } });
  while (current) {
    if (current.id === nodeId) {
      throw new BadRequestException('Cannot create circular reference');
    }
    if (!current.parentId) break;
    current = await this.prisma.node.findUnique({ where: { id: current.parentId } });
  }
}
```

### 2.2 超级标签继承系统

#### 设计理念
实现面向对象的标签继承逻辑，子标签自动继承父标签的字段定义，支持多层级继承链。

#### 继承合并算法

```typescript
// 字段定义继承合并（从根到叶）
private mergeFieldDefinitions(
  ancestorDefs: FieldDefRecord[],
  selfDefs: FieldDefRecord[]
): FieldDefRecord[] {
  const map = new Map<string, FieldDefRecord>();
  
  // 先合并所有祖先字段
  for (const def of ancestorDefs) {
    map.set(def.key, { ...def, inherited: true });
  }
  
  // 子标签字段覆盖父标签同名字段
  for (const def of selfDefs) {
    map.set(def.key, { ...def, inherited: false });
  }
  
  return Array.from(map.values());
}

// 循环继承检测
private async ensureNoCycle(userId: string, tagId: string, newParentId: string) {
  let currentId: string | null = newParentId;
  while (currentId) {
    if (currentId === tagId) {
      throw new BadRequestException('Circular inheritance detected');
    }
    const parent = await this.prisma.supertag.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });
    currentId = parent?.parentId || null;
  }
}
```

#### 字段类型支持

| 类型 | 说明 | 特殊配置 |
|------|------|----------|
| `text` | 文本字段 | - |
| `number` | 数字字段 | - |
| `date` | 日期字段 | - |
| `select` | 单选/多选 | `options: string[]` |
| `reference` | 节点引用 | `targetTagId`, `multiple` |

### 2.3 离线优先同步机制

#### 同步状态机

```
                         ┌────────┐
                         │  idle  │ ◀────────────────┐
                         └────────┘                  │
                              │                      │
                              │ 用户修改数据           │ 3秒后
                              ▼                      │
                         ┌────────┐                  │
              ┌─────────▶│syncing │◀─────────┐      │
              │          └────────┘          │      │
              │               │              │      │
         网络恢复             │            重试      │
              │    ┌──────────┴──────────┐  │      │
              │    │                     │  │      │
              │    ▼                     ▼  │      │
         ┌────────┐               ┌────────┐│  ┌────────┐
         │offline │               │ synced │├─▶│  idle  │
         └────────┘               └────────┘│  └────────┘
              ▲                        │    │
              │                        │    │
         网络断开                   同步成功 │
              │                        │    │
              │    ┌────────┐          │    │
              └────│ error  │◀─────────┘    │
                   └────────┘ 同步失败       │
                        │                   │
                        └───────────────────┘
```

#### 核心实现（syncStore）

```typescript
interface SyncState {
  status: 'idle' | 'syncing' | 'synced' | 'error' | 'offline';
  pendingOperations: SyncOperation[];
  lastSyncTime: number | null;
  error: string | null;
}

// 队列操作（支持合并）
queueOperation: (operation: SyncOperation) => {
  set((state) => {
    const existingIndex = state.pendingOperations.findIndex(
      (op) => op.entityType === operation.entityType && op.entityId === operation.entityId
    );
    
    if (existingIndex >= 0 && operation.type === 'update') {
      // 合并同一实体的更新操作
      const updated = [...state.pendingOperations];
      updated[existingIndex] = {
        ...updated[existingIndex],
        data: { ...updated[existingIndex].data, ...operation.data },
      };
      return { pendingOperations: updated };
    }
    
    return { pendingOperations: [...state.pendingOperations, operation] };
  });
  
  // Debounce 持久化到 localStorage
  debouncedPersist();
};
```

### 2.4 AI 指令节点系统

#### 指令配置模型

```typescript
interface CommandConfig {
  templateId?: string;           // 预设模板 ID
  prompt: string;                // 自定义 Prompt
  contextFilter?: {
    includeParent?: boolean;     // 包含父节点
    includeSiblings?: boolean;   // 包含兄弟节点
    includeChildren?: boolean;   // 包含子节点
    maxDepth?: number;           // 最大深度
    tagFilter?: string[];        // 标签过滤
  };
  maxTokens?: number;            // Token 限制
  model?: 'gpt-4' | 'claude-3-opus' | 'hunyuan-turbo' | 'deepseek-v3';
  lastExecutionStatus?: 'success' | 'error' | 'pending';
  lastError?: string;
}
```

#### 执行流程

```
1. 用户配置指令节点
       │
       ▼
2. 收集上下文（根据 contextFilter）
       │
       ▼
3. 构建 Prompt（模板 + 上下文 + 用户 Prompt）
       │
       ▼
4. 调用 AI 网关（限流 + 重试）
       │
       ▼
5. 流式输出到子节点
       │
       ▼
6. 更新执行状态
```

---

## 三、完整功能清单及模块划分

### 3.1 功能模块总览

#### 核心编辑功能

| 模块 | 功能点 | 实现程度 | 主要文件 |
|------|--------|----------|----------|
| **大纲编辑器** | 无限层级、缩进/反缩进、折叠、拖拽排序 | ✅ 100% | `OutlineEditor.tsx`, `NodeComponent.tsx` |
| **节点操作** | Tab/Shift+Tab、Enter 新建、Backspace 删除 | ✅ 100% | `NodeComponent.tsx` (~875行) |
| **内容编辑** | ContentEditable、Markdown 预览 | ✅ 100% | `NodeContent.tsx` |
| **快捷键系统** | 全局快捷键、编辑快捷键 | ✅ 100% | `useNodeCommand.ts` |

#### 标签系统

| 模块 | 功能点 | 实现程度 | 主要文件 |
|------|--------|----------|----------|
| **超级标签** | 带 Schema 的功能标签 | ✅ 100% | `TagLibrary.tsx` (~914行) |
| **字段定义** | text/number/date/select/reference | ✅ 100% | `TanaStyleFieldRow.tsx` |
| **标签继承** | 父子继承、字段合并、循环检测 | ✅ 100% | `supertagStore.ts` |
| **引用字段** | 目标标签约束、单选/多选 | ✅ 100% | `ReferenceFieldPill.tsx` |
| **默认模板** | 应用标签时自动填充 | ✅ 100% | `supertagStore.ts` |
| **标签选择** | # 触发、搜索过滤 | ✅ 100% | `UnifiedTagSelector.tsx` |

#### 双向链接

| 模块 | 功能点 | 实现程度 | 主要文件 |
|------|--------|----------|----------|
| **@ 提及** | 节点引用、搜索选择 | ✅ 100% | `MentionPopover.tsx` |
| **[[ 双链 ]]** | Wiki 风格链接 | ✅ 100% | `NodeComponent.tsx` |
| **反向链接** | Backlinks 面板 | ✅ 100% | `Backlinks.tsx`, `BacklinksBadge.tsx` |
| **引用预览** | 悬浮预览卡片 | ✅ 100% | `ReferencePreview.tsx` |

#### AI 功能

| 模块 | 功能点 | 实现程度 | 主要文件 |
|------|--------|----------|----------|
| **AI 指令节点** | 12+ 预设模板、自定义 Prompt | ✅ 100% | `CommandNodeView.tsx` |
| **AI 网关** | 统一入口、限流、重试 | ✅ 100% | `services/ai/gateway.ts` |
| **快速捕获** | 文本/语音多模态 | ✅ 100% | `components/capture/` |
| **语音转写** | 语音 → 文本 | ✅ 100% | `/api/ai/transcribe` |
| **Schema 生成** | AI 生成字段定义 | ✅ 100% | `/api/ai/generate-schema` |

#### 导航与视图

| 模块 | 功能点 | 实现程度 | 主要文件 |
|------|--------|----------|----------|
| **侧边栏** | 笔记本列表、日记入口、收藏 | ✅ 100% | `Sidebar.tsx` (~483行) |
| **每日笔记** | 年/月/周/日自动创建 | ✅ 100% | `nodeStore.ts` |
| **笔记本管理** | 多笔记本 CRUD | ✅ 100% | `notebookStore.ts` |
| **命令面板** | ⌘+K 快捷操作 | ✅ 100% | `CommandCenter.tsx` |
| **面包屑** | 路径导航 | ✅ 100% | `CompactBreadcrumb.tsx` |
| **聚焦模式** | Hoist 节点 | ✅ 100% | `OutlineEditor.tsx` |

#### 数据同步

| 模块 | 功能点 | 实现程度 | 主要文件 |
|------|--------|----------|----------|
| **DB-First 同步** | 启动加载、实时同步 | ✅ 100% | `syncStore.ts` |
| **离线队列** | 操作缓存、网络恢复同步 | ✅ 100% | `syncStore.ts`, `syncEngine.ts` |
| **同步指示器** | 状态实时反馈 | ✅ 100% | `SyncStatusIndicator.tsx` |
| **冲突解决** | 服务器/本地/智能合并 | ✅ 100% | `ConflictDialog.tsx` |
| **离线提示** | 网络状态通知 | ✅ 100% | `OfflineToast.tsx` |

#### 用户系统

| 模块 | 功能点 | 实现程度 | 主要文件 |
|------|--------|----------|----------|
| **注册/登录** | NextAuth Credentials | ✅ 100% | `lib/auth.ts` |
| **数据隔离** | userId 过滤 | ✅ 100% | 所有 API 路由 |
| **用户设置** | 键值对存储 | ✅ 100% | `/api/settings` |

### 3.2 组件层级结构

```
src/components/
├── ui/                          # 基础 UI 组件 (shadcn/ui 风格)
│   ├── button.tsx              # 按钮（多变体）
│   ├── dialog.tsx              # 对话框
│   ├── dropdown-menu.tsx       # 下拉菜单
│   ├── popover.tsx             # 弹出框
│   ├── tooltip.tsx             # 工具提示
│   ├── command.tsx             # 命令面板
│   ├── input.tsx / textarea.tsx# 输入组件
│   ├── badge.tsx               # 标签徽章
│   ├── collapsible.tsx         # 折叠组件
│   ├── hover-card.tsx          # 悬浮卡片
│   └── toast.tsx               # 消息提示
│
├── editor/                      # 编辑器组件
│   ├── OutlineEditor.tsx       # 主编辑器容器 (~588行)
│   ├── QuickInputNode.tsx      # 快速输入节点 (~480行)
│   └── FieldEditor.tsx         # 字段编辑器 (~500行)
│
├── node/                        # 节点子组件
│   ├── NodeActions.tsx         # 节点操作按钮
│   ├── NodeCommand.tsx         # AI 指令节点渲染
│   ├── NodeContent.tsx         # 节点内容区域
│   ├── NodeFields.tsx          # 节点字段表格
│   └── NodeReferences.tsx      # 节点引用块
│
├── sidebar/                     # 侧边栏组件
│   ├── Sidebar.tsx             # 主侧边栏 (~483行)
│   └── SidebarItem.tsx         # 侧边栏项
│
├── tag-library/                 # 标签库组件
│   ├── TagLibrary.tsx          # 标签库管理器 (~914行)
│   ├── SchemaFieldList.tsx     # Schema 字段列表
│   └── CategoryManager.tsx     # 分类管理
│
├── capture/                     # 快速捕获组件
│   ├── CaptureBar.tsx          # 捕获输入栏
│   ├── CapturePreview.tsx      # 预览气泡
│   └── VoiceCapture.tsx        # 语音捕获
│
└── [其他业务组件 30+]
    ├── NodeComponent.tsx        # 核心节点组件 (~875行)
    ├── CommandCenter.tsx        # 命令中心
    ├── ContextMenu.tsx          # 右键菜单
    ├── MentionPopover.tsx       # @ 提及弹窗
    ├── UnifiedTagSelector.tsx   # 标签选择器 (~500行)
    ├── TanaStyleFieldRow.tsx    # 字段行 (~550行)
    ├── ReferenceFieldPill.tsx   # 引用字段药丸 (~285行)
    ├── Backlinks.tsx            # 反向链接
    ├── SyncStatusIndicator.tsx  # 同步状态
    ├── ConflictDialog.tsx       # 冲突对话框
    └── OfflineToast.tsx         # 离线提示
```

### 3.3 API 接口清单

#### Next.js API Routes（前端转发层）

| 端点 | 方法 | 功能 | 说明 |
|------|------|------|------|
| `/api/nodes` | GET | 获取节点列表 | 支持 rootNodeId 子树查询 |
| `/api/nodes` | POST | 创建节点 | 支持批量创建 |
| `/api/nodes/[id]` | GET/PATCH/DELETE | 单节点操作 | |
| `/api/nodes/[id]/tree` | GET | 获取节点树 | |
| `/api/nodes/root` | GET | 获取根节点 | |
| `/api/nodes/init-daily` | POST | 初始化日记 | |
| `/api/supertags` | GET/POST | 标签列表/创建 | |
| `/api/supertags/[id]` | GET/PATCH/DELETE | 单标签操作 | |
| `/api/categories` | GET/POST | 分类管理 | |
| `/api/settings` | GET/POST | 用户设置 | |
| `/api/ai/command` | POST | AI 指令执行 | |
| `/api/ai/capture` | POST | AI 快速捕获 | |
| `/api/ai/transcribe` | POST | 语音转写 | |
| `/api/ai/generate-schema` | POST | AI Schema 生成 | |
| `/api/ai/status` | GET | AI 服务状态 | |
| `/api/auth/[...nextauth]` | - | NextAuth 端点 | |
| `/api/auth/register` | POST | 用户注册 | |

#### NestJS 后端 API（业务 SSOT）

| 模块 | 端点 | 方法 | 功能 |
|------|------|------|------|
| Nodes | `/api/nodes` | POST | 创建节点 |
| Nodes | `/api/nodes/batch` | POST | 批量创建 |
| Nodes | `/api/nodes` | GET | 获取节点列表 |
| Nodes | `/api/nodes/root` | GET | 获取根节点 |
| Nodes | `/api/nodes/search` | GET | 搜索节点 |
| Nodes | `/api/nodes/supertag/:id` | GET | 按标签获取 |
| Nodes | `/api/nodes/:id` | GET/PATCH/DELETE | 单节点操作 |
| Nodes | `/api/nodes/:id/tree` | GET | 获取节点树 |
| Nodes | `/api/nodes/:id/move` | PATCH | 移动节点 |
| Nodes | `/api/nodes/:id/indent` | PATCH | 缩进节点 |
| Nodes | `/api/nodes/:id/outdent` | PATCH | 反缩进节点 |
| Nodes | `/api/nodes/:id/toggle-collapse` | PATCH | 切换折叠 |
| Tags | `/api/supertags` | GET/POST | 标签列表/创建 |
| Tags | `/api/supertags/batch` | POST | 批量创建 |
| Tags | `/api/supertags/:id` | GET/PATCH/DELETE | 单标签操作 |
| Tags | `/api/supertags/category/:id` | GET | 按分类获取 |
| Tags | `/api/tags/search` | GET | 搜索标签 |
| Users | `/api/users` | GET/POST | 用户列表/创建 |
| Users | `/api/users/default` | GET | 默认用户 |
| Users | `/api/users/:id` | GET/PATCH/DELETE | 单用户操作 |

### 3.4 数据库模型

```prisma
// 用户表
model User {
  id            String        @id @default(cuid())
  email         String        @unique
  passwordHash  String
  name          String?
  avatar        String?
  isInitialized Boolean       @default(false)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  created_at    DateTime      @default(now())  // 兼容字段
  updated_at    DateTime      @updatedAt       // 兼容字段
  
  categories    Category[]
  nodes         Node[]
  supertags     Supertag[]
  settings      UserSetting[]
}

// 节点表（核心）
model Node {
  id          String    @id @default(cuid())
  userId      String
  parentId    String?
  content     String    @default("")
  nodeType    String    @default("text")      // text, root, daily, command
  nodeRole    String    @default("normal")    // normal, user_root, daily_root
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

  @@index([userId])
  @@index([parentId])
  @@index([supertagId])
  @@index([nodeType])
  @@index([createdAt])
  @@index([userId, nodeRole, parentId])
  @@index([userId, parentId, sortOrder])
}

// 超级标签表
model Supertag {
  id               String     @id @default(cuid())
  userId           String
  name             String
  color            String     @default("#6366F1")
  icon             String?
  fieldDefinitions Json       @default("[]")
  isSystem         Boolean    @default(false)
  categoryId       String     @default("cat_uncategorized")
  description      String?
  order            Int        @default(0)
  parentId         String?                          // 继承父标签
  templateContent  Json?                            // 默认模板
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt

  parent           Supertag?  @relation("SupertagInheritance", fields: [parentId], references: [id])
  children         Supertag[] @relation("SupertagInheritance")
  nodes            Node[]
  user             User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  category         Category?  @relation(fields: [categoryId], references: [id])

  @@unique([userId, name])
  @@index([userId])
  @@index([parentId])
  @@index([categoryId])
}

// 分类表
model Category {
  id          String     @id @default(cuid())
  userId      String
  name        String
  icon        String?
  color       String?
  description String?
  isSystem    Boolean    @default(false)
  order       Int        @default(0)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  supertags   Supertag[]
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, name])
  @@index([userId])
}

// 用户设置表
model UserSetting {
  id        String   @id @default(cuid())
  userId    String
  key       String
  value     Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, key])
  @@index([userId])
}
```

---

## 四、代码质量与性能分析

### 4.1 代码统计

| 指标 | 数量 | 说明 |
|------|------|------|
| **React 组件** | 60+ | 包含 UI 基础组件和业务组件 |
| **Zustand Stores** | 7 个 | nodeStore, supertagStore, syncStore 等 |
| **自定义 Hooks** | 9+ | useNodes, useSupertags, useNodeCommand 等 |
| **API 路由** | 15+ | Next.js API Routes |
| **TypeScript 类型** | ~800 行 | types/index.ts + types/sync.ts |
| **总 TS/TSX 文件** | 200+ | 前端项目 |
| **后端代码** | ~1500 行 | NestJS 业务逻辑 |
| **单元测试用例** | 31 个 | Vitest/Jest |
| **E2E 测试用例** | 6 个 | Playwright |

### 4.2 代码质量优点

| 优点 | 说明 |
|------|------|
| **架构清晰** | 遵循「万物皆节点」理念，数据模型统一 |
| **类型安全** | 全面使用 TypeScript，类型定义完整 |
| **状态管理规范** | Zustand Store 职责分离清晰 |
| **同步机制完善** | 离线队列、重试策略、冲突解决 |
| **组件化良好** | UI 组件复用性高，shadcn/ui 风格统一 |
| **API 契约统一** | `{ success, data/error, code? }` 结构 |
| **测试覆盖** | 核心逻辑有单测和 E2E 覆盖 |
| **文档完善** | ADR 架构决策记录、项目文档齐全 |

### 4.3 性能瓶颈分析

| 问题 | 影响 | 当前状态 |
|------|------|----------|
| **大量节点渲染** | 1000+ 节点时渲染变慢 | 待优化 |
| **NodeComponent 体积** | ~875 行，职责过重 | 已拆分部分 |
| **双 Prisma Schema** | 维护成本高 | 有校验脚本 |
| **无虚拟滚动** | 长列表性能差 | 待实现 |

### 4.4 测试覆盖情况

#### 单元测试 (31 用例)

| 模块 | 测试点 | 状态 |
|------|--------|------|
| **nodeStore** | 缩进/级联、ensureNode、日历 ID 映射 | ✅ |
| **syncStore** | 离线恢复、队列处理、状态切换 | ✅ |
| **supertagStore** | resolvedFieldDefinitions、字段更新 | ✅ |
| **calendarNodeId** | 无前缀/带前缀/多用户前缀解析 | ✅ (10用例) |
| **syncEngine** | 操作执行 | ✅ |
| **后端 NodesService** | CRUD、树操作 | ✅ |
| **后端 UsersService** | 用户管理 | ✅ |

#### E2E 测试 (6 用例)

| 用例 | 覆盖点 | 状态 |
|------|--------|------|
| `api-auth-401` | 未登录 401 + 错误结构 | ✅ |
| `api-error-structure` | 404 统一错误结构 | ✅ |
| `basic-flow` | 主页访问、登录后冒烟 | ✅ |
| `nodes-crud` | 节点增删改查 | ✅ |
| `sync-smoke` | 同步状态指示器 | ✅ |
| `tags-node-link` | 标签与节点关联 | ✅ |

---

## 五、存在的不足与优化建议

### 5.1 架构层面

| 问题 | 优先级 | 现状 | 建议 |
|------|--------|------|------|
| **双 Prisma Schema** | P1 | 有校验脚本 | 考虑使用 monorepo 共享 schema |
| **后端模块未完全迁移** | P2 | 部分逻辑在 Next API | 完成 ADR-006 迁移计划 |
| **缺少 API 版本控制** | P2 | 无版本前缀 | 添加 `/api/v1/` 前缀 |
| **无 API 限流** | P2 | 依赖 AI 网关限流 | 添加全局限流中间件 |

### 5.2 代码层面

| 问题 | 优先级 | 现状 | 建议 |
|------|--------|------|------|
| **NodeComponent 过大** | P1 | ~875 行 | 继续拆分为 ~600 行 |
| **部分组件无 memo** | P2 | 可能重复渲染 | 添加 React.memo 优化 |
| **魔法字符串** | P3 | 部分硬编码 | 提取为常量 |
| **错误边界不完善** | P2 | 部分 API 缺少 | 添加统一错误处理 |

### 5.3 性能层面

| 问题 | 优先级 | 现状 | 建议 |
|------|--------|------|------|
| **无虚拟滚动** | P1 | 大量节点卡顿 | 使用 @tanstack/virtual |
| **无图片懒加载** | P2 | 首屏加载慢 | 使用 next/image |
| **无代码分割** | P2 | 首包较大 | 动态导入重组件 |
| **数据库查询优化** | P2 | 部分 N+1 查询 | 使用 Prisma include |

### 5.4 用户体验

| 问题 | 优先级 | 现状 | 建议 |
|------|--------|------|------|
| **移动端适配不完善** | P2 | 部分组件体验差 | 响应式优化 |
| **无快捷键提示** | P3 | 用户学习成本高 | 添加快捷键面板 |
| **无撤销/重做** | P2 | 误操作难恢复 | 实现操作历史栈 |
| **无协作编辑** | P3 | 单用户模式 | 远期规划 |

### 5.5 安全层面

| 问题 | 优先级 | 现状 | 建议 |
|------|--------|------|------|
| **无 CSRF 防护** | P2 | 依赖 SameSite Cookie | 添加 CSRF Token |
| **无请求签名** | P3 | 仅 userId 过滤 | 添加请求签名验证 |
| **敏感数据日志** | P2 | 可能泄露 | 审计日志脱敏 |

### 5.6 具体优化建议

#### 短期优化 (P1 - 1-2 周)

1. **NodeComponent 继续瘦身**
   ```
   当前：~875 行
   目标：~600 行
   方案：抽取 useNodeTagSelector、useNodeMention、useNodeKeyHandlers
   ```

2. **虚拟滚动实现**
   ```typescript
   // 使用 @tanstack/react-virtual
   import { useVirtualizer } from '@tanstack/react-virtual';
   
   const virtualizer = useVirtualizer({
     count: nodes.length,
     getScrollElement: () => containerRef.current,
     estimateSize: () => 32,
   });
   ```

3. **完善错误边界**
   ```typescript
   // 统一错误处理
   class ErrorBoundary extends React.Component {
     static getDerivedStateFromError(error) {
       return { hasError: true, error };
     }
     // ...
   }
   ```

#### 中期优化 (P2 - 1-2 月)

1. **性能监控接入**
   - 使用 Web Vitals 监控 LCP/FID/CLS
   - 添加 APM 监控（如 Sentry）

2. **移动端适配**
   - 触摸手势支持
   - 响应式布局优化
   - PWA 支持

3. **撤销/重做系统**
   ```typescript
   interface UndoStack {
     past: Operation[];
     present: State;
     future: Operation[];
   }
   ```

#### 长期规划 (P3 - 3-6 月)

1. **协作编辑**
   - CRDT 数据结构
   - WebSocket 实时同步
   - 在线状态感知

2. **插件系统**
   - 插件 API 设计
   - 插件市场
   - 第三方集成

3. **多端支持**
   - React Native 移动端
   - Electron 桌面端

---

## 六、数据库迁移历史

| 迁移 | 日期 | 主要变更 |
|------|------|----------|
| `20260211095133_init` | 2026-02-11 | 初始化 User/Node/Supertag/Category |
| `20260212000000_add_supertag_inheritance_and_template` | 2026-02-12 | 标签继承、模板内容 |
| `20260228235500_align_backend_schema_with_prisma` | 2026-02-28 | 对齐前后端 Schema |
| `20260228242000_users_timestamp_compat_columns` | 2026-02-28 | 用户表时间戳兼容 |
| `20260301000000_add_node_scope_notebook_id` | 2026-03-01 | 添加 scope/notebookId |
| `20260302030000_unified_tree_root_contract` | 2026-03-02 | 统一树根契约 |
| `20260303000000_daily_remove_month_layer` | 2026-03-03 | 移除月份层级 |
| `20260304000000_unified_tree_remove_scope_notebook` | 2026-03-04 | 简化树结构 |

---

## 七、部署配置

### 7.1 Docker 三容器架构

```yaml
services:
  postgres:     # PostgreSQL 16-alpine
    port: 5433:5432
    
  backend:      # NestJS
    port: 4000:4000
    depends_on: postgres
    
  frontend:     # Next.js
    port: 3000:3000
    depends_on: [postgres, backend]
```

### 7.2 环境变量

```bash
# 数据库
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/knowledge_node"

# 认证
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# AI 服务
VENUS_API_KEY="your-api-key"
NEXT_PUBLIC_AI_API_URL="https://api.example.com/v1"
NEXT_PUBLIC_AI_DEFAULT_MODEL="hunyuan-turbo"

# 后端
BACKEND_API_URL="http://backend:4000"
CORS_ORIGIN="http://localhost:3000"
```

### 7.3 启动命令

```bash
# 完整部署
docker-compose up -d --build

# 开发模式
cd knowledge-node-backend && npm run start:dev
cd knowledge-node-nextjs && npm run dev
```

---

## 八、架构决策记录 (ADR)

| ADR | 主题 | 状态 | 日期 |
|-----|------|------|------|
| ADR-002 | 后端 API 边界策略 | Accepted | 2026-02-27 |
| ADR-003 | 日历节点 ID 前缀策略 | Accepted | 2026-02-28 |
| ADR-004 | Nexus 设计 Token | Accepted | 2026-02-28 |
| ADR-005 | 树隔离契约 scope/notebookId | Accepted | 2026-03-01 |
| ADR-006 | 双栈 API 统一为后端 SSOT | Accepted | 2026-03-01 |

---

## 九、总结与展望

### 9.1 v3.0 核心成就

1. **统一树结构**: 实现 user_root + daily_root 双根设计，彻底解决树隔离问题
2. **API 架构升级**: 双栈 API 统一为后端 SSOT，职责清晰
3. **质量保障**: 31 单测 + 6 E2E，核心链路稳定
4. **部署优化**: Docker 三容器编排，一键部署

### 9.2 版本里程碑回顾

| 版本 | 主题 | 核心交付 |
|------|------|----------|
| v2.1.0 | 本体论升级 | 标签继承、引用字段、默认模板、DB-First |
| v2.1.1 | 发布门禁 | E2E、数据库迁移、部署配置 |
| v2.1.2 | 技术债治理 | R1/R2 消除、404 契约、Schema 校验 |
| v3.0.0 | 架构统一 | 统一树结构、双栈 API 统一、质量保障 |

### 9.3 后续规划

| 版本 | 计划功能 | 预计时间 |
|------|----------|----------|
| v3.1 | 性能优化（虚拟滚动、代码分割） | Q2 2026 |
| v3.2 | 协作编辑基础 | Q3 2026 |
| v4.0 | 插件系统 | Q4 2026 |

---

**文档版本**: v3.0.0  
**最后更新**: 2026-03-02  
**维护者**: Knowledge Node Team

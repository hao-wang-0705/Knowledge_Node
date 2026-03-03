# Knowledge Node v3.3 发布说明

> **版本**: v3.3.0  
> **发布日期**: 2026-03-03  
> **分支**: v3.3

---

## 📋 版本概述

v3.3 版本是 Knowledge Node 的重要功能更新，新增了**查询面板系统**和**全局布局优化**，为用户提供更强大的信息检索能力和更灵活的界面布局。

---

## ✨ 新增功能

### 1. 查询面板系统 (Query Panel)

全新的右侧查询面板，支持常驻显示和多查询块管理：

#### 核心特性

- **常驻模式**: 查询面板作为主界面的常驻组件，无需开关操作
- **多查询块**: 支持最多 3 个并行查询块，方便对比和交叉引用
- **实时搜索**: 基于内容和标签的语义化节点搜索
- **响应式宽度**: 面板宽度可调整（320-600px），设置自动持久化

#### 组件架构

```
query-panel/
├── QueryPanel.tsx           # 查询面板主容器
├── QueryPanelHeader.tsx     # 面板头部（标题、新增按钮）
├── QueryBlock.tsx           # 单个查询块
├── QueryBlockContainer.tsx  # 查询块容器
├── QueryBlockHeader.tsx     # 查询块头部（输入、删除）
├── QueryNodeList.tsx        # 查询结果节点列表
└── QueryNodeItem.tsx        # 单个结果节点项
```

#### 技术实现

- **状态管理**: 新增 `queryPanelStore.ts` 专用 Zustand Store
- **类型定义**: 新增 `types/query.ts` 完整类型系统
- **Mock 查询**: 从真实节点数据中筛选匹配结果
- **宽度持久化**: localStorage 自动保存面板宽度偏好

### 2. 全局布局系统 (Global Layout)

重构主界面布局，实现更灵活的三栏结构：

#### 组件架构

```
layout/
├── GlobalLayout.tsx         # 全局布局容器
├── MainContentWrapper.tsx   # 主内容区包装器
├── TopNavigation.tsx        # 顶部导航栏
├── ResizeHandle.tsx         # 拖拽调整手柄
└── index.ts                 # 统一导出
```

#### 布局特性

- **三栏布局**: 侧边栏 + 主内容区 + 查询面板
- **可调整宽度**: 支持拖拽调整各栏宽度
- **响应式设计**: 适配不同屏幕尺寸

---

## 🔧 优化改进

### 代码优化

| 文件 | 变更 | 说明 |
|------|------|------|
| `NodeComponent.tsx` | 优化 | 增强与查询面板的交互兼容 |
| `OutlineEditor.tsx` | 优化 | 布局适配新的全局结构 |
| `SplitPaneProvider.tsx` | 优化 | 支持三栏分屏布局 |
| `globals.css` | 更新 | 新增查询面板相关样式 |
| `layout.tsx` | 更新 | 集成全局布局组件 |

### 类型系统扩展

**新增 `types/query.ts`**:

```typescript
// 查询块状态
export type QueryBlockStatus = 'idle' | 'loading' | 'done' | 'error';

// 查询块接口
export interface QueryBlock {
  id: string;
  queryText: string;
  nodes: string[];      // 仅存储节点 ID
  status: QueryBlockStatus;
  createdAt: number;
  updatedAt?: number;
}

// 面板常量
export const QUERY_PANEL_CONSTANTS = {
  DEFAULT_WIDTH: 380,
  MIN_WIDTH: 320,
  MAX_WIDTH: 600,
  MAX_QUERY_BLOCKS: 3,
};
```

### 标签库页面优化

- `TagLibraryPage.tsx`: 优化与新布局的集成
- `tags/layout.tsx`: 适配全局布局结构
- `tags/page.tsx`: 页面路由优化

---

## 📁 新增文件清单

### 组件文件

| 路径 | 说明 |
|------|------|
| `src/components/query-panel/index.ts` | 查询面板模块入口 |
| `src/components/query-panel/QueryPanel.tsx` | 查询面板主组件 |
| `src/components/query-panel/QueryPanelHeader.tsx` | 面板头部组件 |
| `src/components/query-panel/QueryBlock.tsx` | 查询块组件 |
| `src/components/query-panel/QueryBlockContainer.tsx` | 查询块容器 |
| `src/components/query-panel/QueryBlockHeader.tsx` | 查询块头部 |
| `src/components/query-panel/QueryNodeList.tsx` | 节点列表组件 |
| `src/components/layout/index.ts` | 布局模块入口 |
| `src/components/layout/GlobalLayout.tsx` | 全局布局组件 |
| `src/components/layout/MainContentWrapper.tsx` | 主内容包装器 |
| `src/components/layout/TopNavigation.tsx` | 顶部导航组件 |
| `src/components/layout/ResizeHandle.tsx` | 拖拽手柄组件 |

### 状态管理

| 路径 | 说明 |
|------|------|
| `src/stores/queryPanelStore.ts` | 查询面板状态管理 |

### 类型定义

| 路径 | 说明 |
|------|------|
| `src/types/query.ts` | 查询面板类型定义 |

---

## 📊 技术栈（无变化）

| 类别 | 技术 | 版本 |
|------|------|------|
| **前端框架** | Next.js | 16.x |
| **UI 库** | React | 19.x |
| **状态管理** | Zustand | 5.x |
| **样式** | Tailwind CSS | 4.x |
| **后端框架** | NestJS | 11.x |
| **ORM** | Prisma | 6.x |
| **数据库** | PostgreSQL | 16 |

---

## 🔄 升级指南

### 从 v3.2 升级

1. 拉取最新代码：
   ```bash
   git pull origin v3.3
   ```

2. 安装依赖：
   ```bash
   cd knowledge-node-nextjs && npm install
   ```

3. 启动服务：
   ```bash
   npm run dev
   ```

### 注意事项

- 本版本为纯前端功能更新，无数据库迁移
- 查询面板宽度设置保存在 localStorage，升级后会使用默认值

---

## 🐛 已知问题

- 查询功能目前为 Mock 实现，搜索结果基于本地节点数据
- 后续版本将集成后端 API 实现完整的搜索功能

---

## 📅 版本里程碑

| 版本 | 主题 | 发布日期 |
|------|------|----------|
| v2.1.0 | 本体论升级 | 2026-02-xx |
| v3.0.0 | 架构统一 | 2026-03-02 |
| v3.2.0 | 孤儿节点修复 | 2026-03-02 |
| **v3.3.0** | **查询面板系统** | **2026-03-03** |

---

## 🔜 后续规划

| 版本 | 计划功能 |
|------|----------|
| v3.4 | 查询功能后端 API 实现 |
| v3.5 | 高级搜索（标签过滤、日期范围） |
| v4.0 | 性能优化（虚拟滚动） |

---

**文档版本**: v3.3.0  
**最后更新**: 2026-03-03  
**维护者**: Knowledge Node Team

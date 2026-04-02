# Components Domain Map

按领域分组的组件目录结构，便于管理和扩展。

## 领域目录

| 目录 | 职责 |
|------|------|
| `node/` | 节点渲染（NodeComponent）、节点交互（拖拽、缩进、折叠） |
| `editor/` | 编辑器外壳、命令中心 (CommandCenter)、编辑浮层 |
| `sidebar/` | 导航侧边栏、面包屑 |
| `tag-library/` | 超级标签管理面板、标签选择器、字段编辑 |
| `capture/` | 快速捕获流程组件 |
| `search-node/` | 搜索节点视图、查询构建器、自然语言输入、条件解析预览 |
| `pinned-view/` | 固定视图仪表盘、超级标签聚合展示、Widget 注册与预设 |
| `supertag-focus/` | 超级标签聚焦页面、节点列表、字段标签展示、快速捕获 |
| `split-pane/` | 详情面板、分栏状态适配 |
| `layout/` | 全局布局 (GlobalLayout)、主内容区包装、顶部导航 |
| `query-panel/` | 查询面板 |
| `auth/` | 认证表单（登录/注册） |
| `ui/` | 可复用基础 UI 原件（Button、Dialog、Input 等，基于 Shadcn） |

## 根级遗留组件

部分历史组件仍以平级文件形式存在（如 `OutlineEditor.tsx`、`Sidebar.tsx`、`TagLibrary.tsx` 等），新组件应优先放入对应领域目录。

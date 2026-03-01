# ADR-005: 树隔离契约 scope / notebookId

- 状态: Accepted
- 日期: 2026-03-01
- 决策者: 树隔离架构修复计划

## 背景

每日笔记树与用户笔记本树在数据层未隔离：Node 无归属字段，/api/nodes 按 userId 全量返回，导致笔记本内新建节点刷新后出现在「每日笔记-全部笔记」中。需在架构层明确树边界，保证两棵树并列、节点可引用但不可跨树渲染。

## 决策

1. **Node 显式归属**
   - 新增 `scope: 'general' | 'daily' | 'notebook'`，默认 `general`。
   - 新增 `notebookId: string | null`，仅 `scope=notebook` 时非空。
   - 约定：`scope=notebook` 时 `notebookId` 必填；`scope≠notebook` 时 `notebookId` 为空。

2. **查询契约**
   - GET /api/nodes 支持 `scope` 查询参数；默认返回「非 notebook」树（general + daily），不返回 notebook 节点。
   - notebook 视图使用 `GET /api/nodes?scope=notebook&notebookId=...`。
   - 历史数据（scope 为空）：后端按 Notebook.rootNodeId 做运行时排除，不混入日历根视图。

3. **写入契约**
   - 创建 notebook 时根节点写入 `scope=notebook, notebookId=<notebook.id>`。
   - daily 初始化节点写入 `scope=daily`。
   - 普通根级节点默认 `scope=general`；子节点继承父节点 scope/notebookId。

4. **删除契约**
   - notebook 根节点禁止走通用节点删除接口，须走 notebook 删除接口（级联删子树）。

## 影响

- Prisma Node 模型增加 scope、notebookId 及索引；双栈（nextjs + backend）一致。
- 前端 nodeStore 不再依赖 /api/notebooks 做 fail-open 根过滤，改为消费后端 scope 化接口。
- 前向修复：不自动回填历史数据，兼容读时排除 notebook roots。

# v2.1.1 发布前回归清单

## 一、核心数据链路

- [x] 用户注册/登录成功，首页可访问
- [x] 节点创建、编辑、删除（根节点与子节点）均正常
- [ ] 节点缩进/反缩进后层级与排序正确
- [x] 节点 `supertagId` 与 `fields` 持久化正确
- [ ] 删除父节点时子树级联行为符合预期

## 二、标签与 schema

- [x] 新建标签成功，列表可见
- [x] 标签绑定节点成功，节点详情可读回
- [ ] 标签字段（`fieldDefinitions`）更新后节点编辑器可渲染
- [ ] 继承标签场景下 `resolvedFieldDefinitions` 正确

## 三、同步与一致性

- [x] 连续创建/更新后 `/api/nodes` 读侧数据与写侧一致
- [ ] 离线后恢复网络可自动处理待同步队列
- [ ] 同步状态组件在 `syncing/synced/error/offline` 状态切换正常
- [ ] 冲突处理流程（若触发）可完成并提示清晰

## 四、API 契约一致性（Next / Nest）

- [x] `nodes` 核心响应字段对齐：`id/content/type/parentId/childrenIds/isCollapsed/supertagId/fields/payload`
- [ ] 未登录时统一返回 401 + 错误结构
- [ ] 404/500 错误返回结构一致并可前端消费

## 五、测试执行

- [x] 单元测试：`npm run test` 全绿
- [x] E2E 测试：`npm run test:e2e` 通过 `nodes-crud`、`tags-node-link`、`sync-smoke`
- [ ] 手工冒烟：编辑器打开、输入、标签操作、同步指示器可用

## 六、发布门禁

- [x] 关键改动已有 ADR 与变更说明
- [x] schema 变更已评估迁移影响
- [ ] 分支可构建、可启动、可回滚

---

执行记录（2026-02-28）：
- `npm run test`：11/11 通过
- `npm run test:e2e -- --reporter=list --workers=1`：4/4 通过
- 数据库迁移：`npx prisma migrate deploy` 已执行并成功

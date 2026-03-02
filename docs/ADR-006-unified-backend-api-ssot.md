# ADR-006: 双栈接口统一为后端单一业务源

- 状态: Accepted
- 日期: 2026-03-01
- 决策者: 单一根树结构重构计划

## 背景

当前系统在 `knowledge-node-nextjs` 与 `knowledge-node-backend` 各自维护一套 nodes/notebooks 业务实现，导致以下问题：

1. 同名接口语义漂移（校验规则、删除语义、树隔离规则不一致）
2. bug 修复需要双处改动，容易遗漏
3. 回归测试覆盖困难，导致“修复后仍复发”

本次重构目标是保障树结构稳定，因此必须先消除双实现分叉。

## 决策

1. `knowledge-node-backend` 作为唯一业务 API（SSOT）
   - nodes/notebooks 的读写校验、树约束、防循环、删除保护全部收敛到 Nest 服务层。

2. `knowledge-node-nextjs` 的 `app/api/nodes*` 与 `app/api/notebooks*` 降级为转发层
   - 只做：
     - NextAuth 会话校验
     - 注入 `x-user-id`
     - 响应格式适配（`{ success, data/error }`）
   - 不再在 Next API 中编写树业务逻辑。

3. 客户端 SDK 仅对接 Next API 转发入口
   - 对前端保持兼容，不直接耦合后端部署地址。

## 影响

- 正向：接口复杂度下降，树约束仅需在后端维护一份。
- 迁移风险：切换期间可能出现前后端响应格式差异。
- 防护策略：
  1. 先完成 Next API 转发化
  2. 再迁移/收敛前端调用契约
  3. 构建与回归测试通过后删除旧逻辑。

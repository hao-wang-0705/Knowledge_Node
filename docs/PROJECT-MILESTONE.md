# Knowledge Node 项目里程碑

> SOP Review 阶段性进展汇总 · 2026-02-28

---

## 一、版本与里程碑概览

| 版本 | 里程碑主题 | 发布日期 | 状态 |
|------|-------------|----------|------|
| v2.1.1 | 核心链路稳定 + 发布门禁达标 | 2026-02-28 | 已发布 |
| v2.1.2 | 技术债与残余风险治理 | 2026-02-28 | 已发布 |

---

## 二、v2.1.1 基线（Go/No-Go 通过）

### 发布门禁结果

- 单元测试：通过
- E2E：`basic-flow` / `nodes-crud` / `sync-smoke` / `tags-node-link` 全绿
- 数据库：PostgreSQL 迁移已执行

### 已消除阻塞风险

- P0：数据库不可达 → 拉起 Postgres 容器并执行迁移
- P1：部署配置缺项 → 补齐 NEXTAUTH、VENUS_API_KEY 等
- P1：部署脚本误杀 → deploy.sh 增加 `--force-kill-ports` 显式开关

### 残余风险（v2.1.1 阶段记录）

- ~~R1：middleware 弃用警告~~ → v2.1.2 已消除
- ~~R2：字体外网依赖~~ → v2.1.2 已消除
- R3：部分手工验证 → v2.1.2 E2E 冒烟已自动化

---

## 三、v2.1.2 阶段性进展（技术债治理）

### 阶段一：残余风险消除

| 项 | 动作 | 验收 |
|----|------|------|
| **R1** | middleware → proxy（Next 16） | proxy.ts 替代 middleware.ts，构建无弃用警告 |
| **R2** | 外网字体依赖消除 | 使用系统字体栈，断网可构建 |

### 阶段二：API 契约与回归清单收口

| 项 | 动作 | 验收 |
|----|------|------|
| 404/500 | 统一错误结构 `{ success, error, code? }` + E2E | api-error-structure.spec.ts 覆盖 404 |
| 冲突处理 | ConflictDialog 类型契约覆盖 | 清单勾选，完整 E2E 待后续 |
| 标签字段 | supertagStore 单测 fieldDefinitions 更新 | getResolvedFieldDefinitions 返回新字段 |
| 手工冒烟 | E2E 冒烟（登录→首页→大纲+同步指示器） | basic-flow.spec.ts 覆盖 |

### 阶段三：结构性技术债

| 债项 | 动作 | 验收 |
|------|------|------|
| **债 1** 双 Prisma Schema | `scripts/check-prisma-schema-sync.sh` + README 约定 | CI 可接入，两份 schema 一致 |
| **债 2** NodeComponent | 抽取 useNodeCommand，965→877 行 | 指令节点逻辑独立可测 |
| **债 3** 日历节点 ID | utils/calendarNodeId.ts + 10 单测 + ADR-003 | nodeStore 解耦，多用户前缀可解析 |

---

## 四、架构决策记录（ADR）

| ADR | 主题 | 状态 |
|-----|------|------|
| ADR-002 | 后端 API 边界策略（Next.js 短期主入口、NestJS 中期迁移） | Accepted |
| ADR-003 | 日历节点多用户 ID 前缀策略与解析约定 | Accepted |

---

## 五、质量与测试现状

### 单测覆盖

- **nodeStore**：缩进/级联、ensureNode、日历 ID 映射
- **syncStore**：离线恢复、队列处理、状态切换
- **supertagStore**：resolvedFieldDefinitions、fieldDefinitions 更新
- **calendarNodeId**：无前缀/带前缀/多用户前缀、resolveCalendarParentId
- **syncEngine**：操作执行

### E2E 覆盖

- api-auth-401：未登录 401 + 错误结构
- api-error-structure：404 统一错误结构
- basic-flow：主页可访问、登录后冒烟（大纲+同步指示器）
- nodes-crud / tags-node-link / sync-smoke

### 测试执行记录（2026-02-28）

- `npm run test`：31/31 通过
- `npm run build`：成功（无外网）
- Docker Compose：frontend / backend / postgres 三容器构建与启动成功

---

## 六、部署与交付

| 环境 | 方式 | 分支 | 状态 |
|------|------|------|------|
| GitHub | v2.1.2 分支 | origin/v2.1.2 | 已推送 |
| 本地 Docker | docker compose up -d --build | v2.1.2 | 已部署 |

### 访问入口

- 前端：http://localhost:3000
- 后端 API 文档：http://localhost:4000/api/docs

---

## 七、SOP 阶段定位与后续建议

### 当前阶段

**阶段 5：版本快照（Archive）** — v2.1.2 已提交、推送并完成本地 Docker 部署。

### 建议后续动作

1. **可选：债 2 深化**  
   若需将 NodeComponent 进一步瘦身至 ~600 行，可唤醒 `@Frontend` 抽取 `useNodeTagSelector`、`useNodeMention`、`useNodeKeyHandlers`。

2. **可选：CI 接入**  
   唤醒 CI/DevOps 在 GitHub 分支推送上执行 `scripts/check-prisma-schema-sync.sh` 与 `npm run test`，防止 schema 漂移与回归。

3. **观测建议**  
   上线后 10 分钟观测：`/`、`/api/nodes`、`/api/supertags`，遇异常按“镜像回退 + 保留数据卷”回滚。

---

*文档生成：SOP Review · 2026-02-28*

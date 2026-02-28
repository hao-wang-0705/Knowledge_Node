# v2.1.1 Go/No-Go 简报

日期：2026-02-28  
结论：**Go（可发布）**

## 1. 发布门禁结果

- 单元测试：`npm run test` 通过（11/11）
- 核心 E2E：`npm run test:e2e -- --reporter=list --workers=1` 通过（4/4）
  - `basic-flow`
  - `nodes-crud`
  - `sync-smoke`
  - `tags-node-link`
- 数据库：`localhost:5433` 可达，`prisma migrate deploy` 已成功执行

## 2. 本次已消除的阻塞风险

- P0：数据库不可达导致注册失败  
  - 处理：拉起 PostgreSQL 容器并执行迁移，恢复 `users` 等核心表
- P1：部署配置缺项  
  - 处理：补齐 Compose 必需环境变量（`NEXTAUTH_URL`、`NEXTAUTH_SECRET`、`VENUS_API_KEY`）
- P1：部署脚本误杀风险  
  - 处理：`deploy.sh` 改为默认只提示端口占用，需显式 `--force-kill-ports` 才强制释放

## 3. 残余风险项（不阻塞本次发布）

- R1：Next 警告 `middleware` 约定已弃用（建议后续迁移到 `proxy`）
- R2：前端生产构建依赖外部字体源（受限网络环境可能失败）
- R3：回归清单中部分“手工验证项”尚未逐条打勾（不影响本次核心门禁）

## 4. 发布建议

1. 按 `v2.1.1` 分支发布（核心链路已达标）
2. 发布后执行 10 分钟在线观测：
   - `/`
   - `/api/nodes`
   - `/api/supertags`
3. 若出现认证或数据库异常，按“镜像 tag 回退 + 保留数据卷”策略回滚

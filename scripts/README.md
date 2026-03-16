# 脚本目录

本目录包含仓库级别的运维与校验脚本。

## 保留脚本（持续使用）

| 脚本 | 用途 |
|------|------|
| `check-prisma-schema-sync.sh` / `check-prisma-schema-sync.mjs` | 校验 knowledge-node-backend 与 knowledge-node-nextjs 的 Prisma schema 一致性；根目录 README 引用。 |
| `docker-start.sh` | Docker 相关启动。 |
| `deploy.sh` | 部署流程。 |
| `github-setup.sh` | GitHub 仓库/CI 初始化。 |

## 历史/一次性脚本

以下脚本已移至 `archive/`，仅作历史保留或一次性使用：

| 脚本 | 用途 |
|------|------|
| `archive/verify-daily-notes-fix.sh` | 曾用于验证 Daily Notes 修复后的日历层级与 API 行为，一次性验证。 |
| `archive/rename-tags-to-chinese.sh` | 曾用于将预设超级标签英文名改为中文，一次性数据迁移。 |

如需执行归档脚本，请从仓库根目录运行：`./scripts/archive/<脚本名>`。

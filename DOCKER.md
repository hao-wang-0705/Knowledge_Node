# Docker 构建与部署

在项目根目录执行以下命令。

## 构建并启动（推荐）

```bash
docker compose up -d --build
```

- 首次会构建 `backend`、`frontend` 镜像并启动三个服务：`postgres`、`backend`、`frontend`。
- 之后代码变更需重新构建时同样使用：`docker compose up -d --build`。

## 仅构建

```bash
docker compose build
```

## 仅启动（使用已有镜像）

```bash
docker compose up -d
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `docker compose logs -f` | 查看所有服务日志 |
| `docker compose logs -f frontend` | 仅前端日志 |
| `docker compose ps` | 查看服务状态 |
| `docker compose down` | 停止并删除容器（数据卷保留） |
| `docker compose down -v` | 停止并删除容器及数据卷 |

## 环境变量

可在项目根目录创建 `.env` 文件覆盖默认值，例如：

- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`：数据库
- `BACKEND_PORT` / `FRONTEND_PORT`：端口（默认 4000 / 3000）
- `NEXTAUTH_SECRET`：NextAuth 密钥（生产环境必改）
- `INTERNAL_API_KEY`：前后端内部调用密钥
- `GEMINI_API_KEY` / `OPENAI_API_KEY` 等：AI 服务

后端启动时会自动执行 `prisma migrate deploy`，无需单独跑迁移。

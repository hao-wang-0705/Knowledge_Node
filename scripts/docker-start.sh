#!/usr/bin/env bash
# Knowledge Node 快速启动脚本
# 简化版启动，完整功能请使用 ./scripts/deploy.sh
#
# 使用说明:
#   ./scripts/docker-start.sh          # 快速启动
#   ./scripts/deploy.sh --no-cache     # 强制重建（推荐部署新版本时使用）
#   ./scripts/deploy.sh --clean        # 完全清理后重建
#

set -e
cd "$(dirname "$0")/.."

# 取消 DOCKER_HOST 环境变量以使用正确的 Docker context
unset DOCKER_HOST

echo ">>> 释放端口 3000、4000、5433 ..."
for port in 3000 4000 5433; do
  pid=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "    端口 $port 占用 (PID $pid)，正在结束进程"
    kill -9 $pid 2>/dev/null || true
  fi
done
echo ">>> 端口检查完成"

echo ">>> 停止已有容器 ..."
docker compose down 2>/dev/null || docker-compose down 2>/dev/null || true

echo ">>> 构建并启动 (postgres + backend + frontend) ..."
BUILD_TIMESTAMP=$(date +%Y%m%d%H%M%S)
docker compose up -d --build 2>/dev/null || docker-compose up -d --build

echo ""
echo ">>> 启动完成。"
echo "    前端: http://localhost:3000"
echo "    后端: http://localhost:4000"
echo "    API 文档: http://localhost:4000/api/docs"
echo "    数据库: localhost:5433 (user/postgres, db/knowledge_node)"
echo ""
echo ">>> 提示: 如需强制重建最新版本，请使用:"
echo "    ./scripts/deploy.sh --no-cache"

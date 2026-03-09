#!/usr/bin/env bash
#
# Knowledge Node 部署脚本
# 确保部署最新版本的功能，包括：
# - 清理 Docker 构建缓存
# - 强制重新构建镜像
# - 数据库迁移
# - 健康检查
#
# 使用方法：
#   ./scripts/deploy.sh [选项]
#
# 选项：
#   --no-cache    强制不使用 Docker 构建缓存
#   --clean       完全清理后重建（删除旧镜像和卷）
#   --dev         使用开发模式启动（不使用 Docker）
#   --force-kill-ports  强制释放被占用端口（危险）
#   --reset-nodes 清空 nodes 业务数据（保留用户）
#   --help        显示帮助信息
#

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# 取消 DOCKER_HOST 环境变量以使用正确的 Docker context
unset DOCKER_HOST

# 默认配置
NO_CACHE=false
CLEAN_BUILD=false
DEV_MODE=false
FORCE_KILL_PORTS=false
RESET_NODES=false
BUILD_TIMESTAMP=$(date +%Y%m%d%H%M%S)

# 显示帮助信息
show_help() {
    echo "Knowledge Node 部署脚本"
    echo ""
    echo "使用方法："
    echo "  ./scripts/deploy.sh [选项]"
    echo ""
    echo "选项："
    echo "  --no-cache    强制不使用 Docker 构建缓存"
    echo "  --clean       完全清理后重建（删除旧镜像）"
    echo "  --dev         使用开发模式启动（不使用 Docker）"
    echo "  --force-kill-ports  强制释放被占用端口（危险）"
    echo "  --reset-nodes 清空 nodes 业务数据（保留用户）"
    echo "  --help        显示帮助信息"
    echo ""
    echo "示例："
    echo "  ./scripts/deploy.sh                # 普通部署"
    echo "  ./scripts/deploy.sh --no-cache     # 强制重新构建"
    echo "  ./scripts/deploy.sh --clean        # 完全清理后部署"
}

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        --clean)
            CLEAN_BUILD=true
            NO_CACHE=true
            shift
            ;;
        --dev)
            DEV_MODE=true
            shift
            ;;
        --force-kill-ports)
            FORCE_KILL_PORTS=true
            shift
            ;;
        --reset-nodes)
            RESET_NODES=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}未知选项: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Knowledge Node v2.1 部署脚本                        ║${NC}"
echo -e "${BLUE}║        构建时间: $BUILD_TIMESTAMP                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 步骤 1: 检查端口占用
echo -e "${YELLOW}[1/7] 检查端口占用...${NC}"
for port in 3000 4000 5433; do
    pid=$(lsof -ti :$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        if [ "$FORCE_KILL_PORTS" = true ]; then
            echo -e "  ${YELLOW}端口 $port 被占用 (PID: $pid)，正在强制释放...${NC}"
            kill -9 $pid 2>/dev/null || true
            sleep 1
        else
            echo -e "  ${YELLOW}端口 $port 被占用 (PID: $pid)，默认不杀进程${NC}"
        fi
    fi
done
echo -e "  ${GREEN}✓ 端口检查完成${NC}"

# 步骤 2: 停止现有容器
echo -e "${YELLOW}[2/7] 停止现有容器...${NC}"
docker compose down --remove-orphans 2>/dev/null || docker-compose down --remove-orphans 2>/dev/null || true
echo -e "  ${GREEN}✓ 容器已停止${NC}"

# 步骤 3: 清理构建缓存（如果指定）
if [ "$CLEAN_BUILD" = true ]; then
    echo -e "${YELLOW}[3/7] 执行完全清理...${NC}"
    
    # 删除项目相关的镜像
    echo -e "  删除旧镜像..."
    docker rmi knowledge_node-frontend knowledge_node-backend 2>/dev/null || true
    docker rmi $(docker images -q --filter "dangling=true") 2>/dev/null || true
    
    # 清理构建缓存
    echo -e "  清理构建缓存..."
    docker builder prune -f 2>/dev/null || true
    
    # 删除前端和后端的构建产物
    echo -e "  清理本地构建产物..."
    rm -rf "$PROJECT_ROOT/knowledge-node-nextjs/.next" 2>/dev/null || true
    rm -rf "$PROJECT_ROOT/knowledge-node-nextjs/node_modules/.cache" 2>/dev/null || true
    rm -rf "$PROJECT_ROOT/knowledge-node-backend/dist" 2>/dev/null || true
    
    echo -e "  ${GREEN}✓ 清理完成${NC}"
else
    echo -e "${YELLOW}[3/7] 跳过完全清理（使用 --clean 启用）${NC}"
fi

# 步骤 4: 写入构建版本信息
echo -e "${YELLOW}[4/7] 生成构建版本信息...${NC}"

# 获取 Git 信息（如果可用）
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

# 创建构建信息文件
cat > "$PROJECT_ROOT/.build-info" << EOF
BUILD_TIMESTAMP=$BUILD_TIMESTAMP
GIT_COMMIT=$GIT_COMMIT
GIT_BRANCH=$GIT_BRANCH
BUILD_MODE=$([ "$NO_CACHE" = true ] && echo "no-cache" || echo "cached")
EOF

echo -e "  构建版本: $GIT_COMMIT ($GIT_BRANCH)"
echo -e "  ${GREEN}✓ 版本信息已生成${NC}"

# 步骤 5: 构建 Docker 镜像
echo -e "${YELLOW}[5/7] 构建 Docker 镜像...${NC}"

BUILD_ARGS="--build-arg BUILD_TIMESTAMP=$BUILD_TIMESTAMP"

if [ "$NO_CACHE" = true ]; then
    echo -e "  ${YELLOW}使用 --no-cache 模式构建${NC}"
    docker compose build --no-cache $BUILD_ARGS 2>/dev/null || docker-compose build --no-cache $BUILD_ARGS
else
    docker compose build $BUILD_ARGS 2>/dev/null || docker-compose build $BUILD_ARGS
fi

echo -e "  ${GREEN}✓ 镜像构建完成${NC}"

# 步骤 6: 启动服务
echo -e "${YELLOW}[6/7] 启动数据库并执行迁移...${NC}"
docker compose up -d postgres 2>/dev/null || docker-compose up -d postgres

echo -n "  等待 PostgreSQL ready: "
MAX_RETRIES=60
RETRY_COUNT=0
until docker exec knowledge-node-postgres pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-knowledge_node}" >/dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
      echo -e "${RED}✗ 超时${NC}"
      exit 1
    fi
    sleep 1
done
echo -e "${GREEN}✓${NC}"

echo -e "  执行智能迁移..."

# 智能判断：新部署 vs 已有部署
# 检查 _prisma_migrations 表是否存在
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-knowledge_node}"
HAS_MIGRATIONS=$(docker exec knowledge-node-postgres psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_prisma_migrations');" 2>/dev/null || echo "f")

if [ "$HAS_MIGRATIONS" = "t" ]; then
    # 已有部署：检查是否已有迁移记录
    MIGRATION_COUNT=$(docker exec knowledge-node-postgres psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM _prisma_migrations;" 2>/dev/null || echo "0")
    
    if [ "$MIGRATION_COUNT" -gt "0" ]; then
        echo -e "  ${BLUE}检测到已有部署 ($MIGRATION_COUNT 条迁移记录)${NC}"
        
        # 检查基线迁移是否已标记
        BASELINE_EXISTS=$(docker exec knowledge-node-postgres psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT 1 FROM _prisma_migrations WHERE migration_name = '0000_baseline');" 2>/dev/null || echo "f")
        
        if [ "$BASELINE_EXISTS" = "f" ]; then
            echo -e "  ${YELLOW}标记基线迁移为已应用...${NC}"
            docker compose run --rm backend sh -c "npx prisma migrate resolve --applied 0000_baseline" 2>/dev/null || docker-compose run --rm backend sh -c "npx prisma migrate resolve --applied 0000_baseline"
        fi
    fi
else
    echo -e "  ${BLUE}检测到全新部署，将执行基线迁移${NC}"
fi

# 执行迁移（带回退机制）
MIGRATE_SUCCESS=false

# 尝试 1: prisma migrate deploy（标准迁移）
echo -e "  尝试标准迁移 (migrate deploy)..."
if docker compose run --rm backend sh -c "npx prisma migrate deploy" 2>/dev/null || docker-compose run --rm backend sh -c "npx prisma migrate deploy" 2>/dev/null; then
  MIGRATE_SUCCESS=true
  echo -e "  ${GREEN}✓ 标准迁移成功${NC}"
else
  echo -e "  ${YELLOW}⚠ 标准迁移失败，尝试回退方案...${NC}"
  
  # 尝试 2: prisma db push（回退方案，适用于全新部署或迁移文件问题）
  echo -e "  尝试 Schema 同步 (db push)..."
  if docker compose run --rm backend sh -c "npx prisma db push --accept-data-loss" 2>/dev/null || docker-compose run --rm backend sh -c "npx prisma db push --accept-data-loss" 2>/dev/null; then
    MIGRATE_SUCCESS=true
    echo -e "  ${YELLOW}⚠ 已通过 db push 同步 Schema（非标准迁移路径）${NC}"
  fi
fi

if [ "$MIGRATE_SUCCESS" = false ]; then
  echo -e "${RED}✗ 数据库迁移失败（migrate deploy 和 db push 均失败），停止部署${NC}"
  exit 1
fi

# 执行 Seed
echo -e "  执行数据库 Seed..."
if docker compose run --rm backend sh -c "npx prisma db seed" 2>/dev/null || docker-compose run --rm backend sh -c "npx prisma db seed" 2>/dev/null; then
  echo -e "  ${GREEN}✓ Seed 完成${NC}"
else
  echo -e "  ${YELLOW}⚠ Seed 失败（可能数据已存在，继续部署）${NC}"
fi

echo -e "  ${GREEN}✓ 数据库初始化完成${NC}"

echo -e "  启动 backend/frontend..."
docker compose up -d backend frontend 2>/dev/null || docker-compose up -d backend frontend
sleep 5
echo -e "  ${GREEN}✓ 服务已启动${NC}"

if [ "$RESET_NODES" = true ]; then
    echo -e "  ${YELLOW}升级模式：清空 nodes 业务数据（保留用户）...${NC}"
    DB_USER="${POSTGRES_USER:-postgres}"
    DB_NAME="${POSTGRES_DB:-knowledge_node}"
    docker exec knowledge-node-postgres psql -U "$DB_USER" -d "$DB_NAME" -c 'TRUNCATE TABLE "nodes" CASCADE;' >/dev/null
    echo -e "  ${GREEN}✓ nodes 已清空${NC}"
fi

# 步骤 7: 健康检查
echo -e "${YELLOW}[7/7] 执行健康检查...${NC}"

echo -n "  Backend live: "
MAX_RETRIES=60
RETRY_COUNT=0
until curl -fsS http://localhost:4000/health/live >/dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
      echo -e "${RED}✗ 超时${NC}"
      docker compose logs backend --tail=20 || true
      exit 1
    fi
    sleep 2
done
echo -e "${GREEN}✓${NC}"

echo -n "  Backend ready: "
RETRY_COUNT=0
until curl -fsS http://localhost:4000/health/ready >/dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
      echo -e "${RED}✗ 超时${NC}"
      docker compose logs backend --tail=20 || true
      exit 1
    fi
    sleep 2
done
echo -e "${GREEN}✓${NC}"

echo -n "  Frontend health: "
MAX_RETRIES=30
RETRY_COUNT=0
until curl -fsS http://localhost:3000/api/health >/dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
      echo -e "${RED}✗ 超时${NC}"
      docker compose logs frontend --tail=20 || true
      exit 1
    fi
    sleep 1
done
echo -e "${GREEN}✓${NC}"

# 显示容器状态
echo ""
echo -e "${BLUE}容器状态:${NC}"
docker compose ps

# 显示访问信息
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    部署完成！                              ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  前端应用:    http://localhost:3000                        ║${NC}"
echo -e "${GREEN}║  后端 API:    http://localhost:4000                        ║${NC}"
echo -e "${GREEN}║  API 文档:    http://localhost:4000/api/docs               ║${NC}"
echo -e "${GREEN}║  数据库:      localhost:5433 (postgres/postgres)           ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  构建版本:    $GIT_COMMIT ($GIT_BRANCH)                    ║${NC}"
echo -e "${GREEN}║  构建时间:    $BUILD_TIMESTAMP                             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"

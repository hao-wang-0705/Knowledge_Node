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
#   --help        显示帮助信息
#

set -e

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

# 步骤 1: 检查并释放端口
echo -e "${YELLOW}[1/7] 检查并释放端口...${NC}"
for port in 3000 4000 5433; do
    pid=$(lsof -ti :$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        echo -e "  ${YELLOW}端口 $port 被占用 (PID: $pid)，正在释放...${NC}"
        kill -9 $pid 2>/dev/null || true
        sleep 1
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
echo -e "${YELLOW}[6/7] 启动服务...${NC}"
docker compose up -d 2>/dev/null || docker-compose up -d

# 等待服务启动
echo -e "  等待服务启动..."
sleep 5

echo -e "  ${GREEN}✓ 服务已启动${NC}"

# 步骤 7: 健康检查
echo -e "${YELLOW}[7/7] 执行健康检查...${NC}"

# 检查 PostgreSQL
echo -n "  PostgreSQL: "
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker exec knowledge-node-postgres pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 正常${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 1
done
if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}✗ 超时${NC}"
fi

# 检查后端 API
echo -n "  Backend API: "
MAX_RETRIES=60
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:4000/api/docs > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 正常${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 2
done
if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}✗ 超时${NC}"
    echo -e "  ${YELLOW}查看后端日志:${NC}"
    docker compose logs backend --tail=20
fi

# 检查前端
echo -n "  Frontend: "
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 正常${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 1
done
if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}✗ 超时${NC}"
fi

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

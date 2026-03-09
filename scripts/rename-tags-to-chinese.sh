#!/bin/bash
# 脚本用途：将预设超级标签的英文名改为中文
# 执行方式：./scripts/rename-tags-to-chinese.sh
# 
# 改动列表：
# - Meeting → 会议
# - Idea → 灵感
# - Book → 书籍

set -e

echo "🏷️  开始更新预设标签名称为中文..."

# 检测运行环境
if [ -n "$DATABASE_URL" ]; then
    # Docker 环境内部执行
    echo "📦 检测到 Docker 环境"
    PSQL_CMD="psql \$DATABASE_URL"
elif command -v docker &> /dev/null && docker ps --format '{{.Names}}' | grep -q 'knowledge-node-postgres'; then
    # 本地通过 Docker 执行
    echo "🐳 通过 Docker 容器执行"
    PSQL_CMD="docker exec knowledge-node-postgres psql -U postgres -d knowledge_node -c"
else
    # 本地直接执行
    echo "💻 本地直接执行"
    PSQL_CMD="psql -U postgres -d knowledge_node -h localhost -p 5433 -c"
fi

echo ""
echo "📋 更新前的标签名称："
$PSQL_CMD "SELECT id, name, icon FROM tag_templates ORDER BY \"order\";"

echo ""
echo "🔄 执行更新..."

# 执行更新
$PSQL_CMD "UPDATE tag_templates SET name = '会议' WHERE name = 'Meeting';"
$PSQL_CMD "UPDATE tag_templates SET name = '灵感' WHERE name = 'Idea';"
$PSQL_CMD "UPDATE tag_templates SET name = '书籍' WHERE name = 'Book';"

echo ""
echo "✅ 更新完成！新的标签名称："
$PSQL_CMD "SELECT id, name, icon FROM tag_templates ORDER BY \"order\";"

echo ""
echo "🎉 所有预设标签名称已更新为中文！"

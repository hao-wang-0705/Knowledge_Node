#!/bin/bash

# Knowledge Node GitHub 上传脚本
# 使用方法：bash scripts/github-setup.sh

GH_BIN="/tmp/gh_2.63.2_macOS_amd64/bin/gh"

echo "=========================================="
echo "Knowledge Node GitHub 上传向导"
echo "=========================================="
echo ""

# 检查 gh 是否存在
if [ ! -f "$GH_BIN" ]; then
    echo "❌ GitHub CLI 未找到，请先运行："
    echo "   cd /tmp && curl -sLO https://github.com/cli/cli/releases/download/v2.63.2/gh_2.63.2_macOS_amd64.zip && unzip -o gh_2.63.2_macOS_amd64.zip"
    exit 1
fi

# 检查登录状态
echo "📋 检查 GitHub 登录状态..."
if ! $GH_BIN auth status 2>/dev/null; then
    echo ""
    echo "🔐 需要登录 GitHub，请按照提示操作："
    echo "   - 选择 'GitHub.com'"
    echo "   - 选择 'HTTPS'"
    echo "   - 选择 'Login with a web browser' 或 'Paste an authentication token'"
    echo ""
    $GH_BIN auth login
    
    if [ $? -ne 0 ]; then
        echo "❌ 登录失败"
        exit 1
    fi
fi

echo ""
echo "✅ GitHub 已登录"
echo ""

# 切换到项目目录
cd "$(dirname "$0")/.."

# 创建仓库并推送
echo "🚀 创建 GitHub 仓库并推送代码..."
echo ""

# 询问仓库可见性
read -p "仓库可见性 (private/public) [private]: " visibility
visibility=${visibility:-private}

if [ "$visibility" = "public" ]; then
    $GH_BIN repo create Knowledge_Node --public --source=. --remote=origin --push --description "AI-Native 节点式知识操作系统 - 将笔记的灵活性与数据库的强大功能相结合"
else
    $GH_BIN repo create Knowledge_Node --private --source=. --remote=origin --push --description "AI-Native 节点式知识操作系统 - 将笔记的灵活性与数据库的强大功能相结合"
fi

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ 成功！仓库已创建并推送到 GitHub"
    echo "=========================================="
    echo ""
    $GH_BIN repo view --web
else
    echo ""
    echo "❌ 创建仓库失败，请检查错误信息"
fi

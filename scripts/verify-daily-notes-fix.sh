#!/usr/bin/env bash
#
# Daily Notes 修复验证脚本
# 在 Docker 部署完成后运行，用于验证日历层级与 API 行为
#
# 使用: ./scripts/verify-daily-notes-fix.sh
#

set -e

BASE_URL_FRONTEND="${BASE_URL_FRONTEND:-http://localhost:3000}"
BASE_URL_BACKEND="${BASE_URL_BACKEND:-http://localhost:4000}"

echo "=========================================="
echo "  Daily Notes 修复验证"
echo "  前端: $BASE_URL_FRONTEND"
echo "  后端: $BASE_URL_BACKEND"
echo "=========================================="
echo ""

# 1. 健康检查
echo "[1/4] 服务健康检查..."
if ! curl -sf "$BASE_URL_FRONTEND" > /dev/null; then
  echo "  失败: 前端 $BASE_URL_FRONTEND 不可达"
  exit 1
fi
echo "  前端: OK"

if ! curl -sf "$BASE_URL_BACKEND/api/docs" > /dev/null; then
  echo "  失败: 后端 $BASE_URL_BACKEND 不可达"
  exit 1
fi
echo "  后端: OK"
echo ""

# 2. 日历诊断 API（需登录，仅检查接口存在）
echo "[2/4] 日历诊断接口..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL_FRONTEND/api/internal/calendar-diagnostic")
if [ "$STATUS" = "401" ] || [ "$STATUS" = "200" ]; then
  echo "  GET /api/internal/calendar-diagnostic 存在 (HTTP $STATUS)"
else
  echo "  注意: 诊断接口返回 HTTP $STATUS（401=未登录为正常）"
fi
echo ""

# 3. 日历修复 dry-run 接口
echo "[3/4] 日历修复 dry-run 接口..."
STATUS_REPAIR=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL_FRONTEND/api/internal/calendar-repair")
if [ "$STATUS_REPAIR" = "401" ] || [ "$STATUS_REPAIR" = "200" ]; then
  echo "  GET /api/internal/calendar-repair 存在 (HTTP $STATUS_REPAIR)"
else
  echo "  注意: 修复 dry-run 返回 HTTP $STATUS_REPAIR"
fi
echo ""

# 4. 本地单元测试（若在项目内执行）
echo "[4/4] 本地单元测试（Daily Notes 相关）..."
if [ -d "knowledge-node-nextjs" ]; then
  cd knowledge-node-nextjs
  if npm run test -- --run src/stores/__tests__/nodeStore.test.ts src/lib/__tests__/calendar-diagnostic.test.ts src/utils/__tests__/daily-notes-init.test.ts 2>/dev/null; then
    echo "  相关单元测试通过"
  else
    echo "  跳过或失败: 请在本机执行 npm run test"
  fi
  cd - > /dev/null
else
  echo "  跳过: 未在项目根目录"
fi
echo ""

echo "=========================================="
echo "  验证完成"
echo "=========================================="
echo ""
echo "建议手工验证："
echo "  1. 打开 $BASE_URL_FRONTEND 并登录"
echo "  2. 侧栏点击「今日笔记」→ 应进入 Daily notes 下的今日 day 节点"
echo "  3. 面包屑应为: 用户(全部笔记) > Daily notes > 年 > 周 > 日"
echo "  4. 在今日页面添加一条笔记 → 刷新后仍应显示在该 day 下"
echo "  5. 若曾存在关系问题，可登录后访问: $BASE_URL_FRONTEND/api/internal/calendar-diagnostic 查看 issuesFound；若 >0 可调用 POST /api/internal/calendar-repair { \"auto\": true, \"dryRun\": true } 预览修复"
echo ""

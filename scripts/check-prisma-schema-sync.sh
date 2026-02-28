#!/usr/bin/env bash
# 双 Prisma Schema 一致性校验（忽略空白与模型顺序）
# 从仓库根目录执行：./scripts/check-prisma-schema-sync.sh
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"
node "$SCRIPT_DIR/check-prisma-schema-sync.mjs"

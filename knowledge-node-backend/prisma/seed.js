/**
 * Prisma 种子脚本
 * 
 * v3.5: 预置标签已移至数据库驱动 + 管理员 API 热更新模式
 * 硬编码的 PRESET_TAGS 数组已清空，请使用以下方式管理预置标签：
 * 
 * 1. 管理员 API: POST /api/internal/tags/batch - 批量导入
 * 2. 管理员 API: PUT /api/internal/tags/:id - 更新单个标签
 * 3. 管理员 API: DELETE /api/internal/tags/:id - 删除标签
 * 4. 初始化配置: prisma/preset-tags.json + import-preset-tags.ts 脚本
 * 
 * 此文件保留作为 Prisma seed 入口，可用于其他初始化逻辑
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * 预置标签数组 - 已清空
 * @deprecated v3.5: 预置标签现通过管理员 API 管理，不再硬编码
 */
const PRESET_TAGS = [];

async function main() {
  console.log('[seed] 启动数据库种子脚本...');
  
  if (PRESET_TAGS.length === 0) {
    console.log('[seed] 预置标签已移至管理员 API 管理模式，跳过硬编码种子');
    console.log('[seed] 如需初始化预置标签，请使用:');
    console.log('[seed]   - POST /api/internal/tags/batch');
    console.log('[seed]   - 或运行 import-preset-tags.ts 脚本');
    return;
  }
  
  // 保留 upsert 逻辑以防未来需要
  for (const tag of PRESET_TAGS) {
    console.log(`[seed] 处理标签: ${tag.name}`);
  }
  
  console.log('[seed] 种子脚本执行完成');
}

main()
  .catch((error) => {
    console.error('[seed] failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

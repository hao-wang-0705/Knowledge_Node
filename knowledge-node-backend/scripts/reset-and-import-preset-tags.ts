/**
 * v4.2: 清空存量标签与节点标签信息，并导入实体+行动双轨预置标签
 *
 * 使用方式：
 * ADMIN_API_KEY=xxx npx ts-node scripts/reset-and-import-preset-tags.ts
 * 或
 * ADMIN_API_KEY=xxx npx tsx scripts/reset-and-import-preset-tags.ts
 *
 * 环境变量：
 * - ADMIN_API_KEY: 管理员密钥（必需）
 * - API_BASE_URL: API 基础 URL（默认 http://localhost:3001）
 */

import * as fs from 'fs';
import * as path from 'path';

interface PresetTagsConfig {
  description?: string;
  tags: Array<{
    name: string;
    category?: string;
    color?: string;
    icon?: string;
    description?: string;
    order?: number;
    fieldDefinitions?: any[];
    templateContent?: any;
    isGlobalDefault?: boolean;
    status?: string;
  }>;
}

async function main(): Promise<void> {
  const adminKey = process.env.ADMIN_API_KEY;
  const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001';

  if (!adminKey) {
    console.error('❌ 错误: ADMIN_API_KEY 环境变量未设置');
    process.exit(1);
  }

  const headers = {
    'Content-Type': 'application/json',
    'x-admin-key': adminKey,
  };

  // 1. 重置：清空节点标签信息、删除所有标签与用户订阅
  console.log('🔄 调用 POST /api/internal/tags/reset ...');
  const resetRes = await fetch(`${apiBaseUrl}/api/internal/tags/reset`, {
    method: 'POST',
    headers,
  });
  if (!resetRes.ok) {
    const text = await resetRes.text();
    throw new Error(`reset 失败: ${resetRes.status} ${text}`);
  }
  const resetData = await resetRes.json();
  console.log('✅ 重置完成:', resetData);

  // 2. 读取预置配置并批量导入
  const configPath = path.join(__dirname, '../prisma/preset-tags.json');
  if (!fs.existsSync(configPath)) {
    console.error(`❌ 找不到配置文件 ${configPath}`);
    process.exit(1);
  }
  const config: PresetTagsConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  if (!config.tags?.length) {
    console.log('ℹ️ 预置配置无标签，跳过导入');
    return;
  }

  console.log(`\n📂 导入 ${config.tags.length} 个预置标签...`);
  const batchRes = await fetch(`${apiBaseUrl}/api/internal/tags/batch`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tags: config.tags, overwrite: false }),
  });
  if (!batchRes.ok) {
    const text = await batchRes.text();
    throw new Error(`batch 导入失败: ${batchRes.status} ${text}`);
  }
  const batchData = await batchRes.json();
  console.log('✅ 导入完成:', batchData);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

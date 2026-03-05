/**
 * 导入预置标签脚本
 * v3.5: 从 preset-tags.json 批量导入预置标签到数据库
 * 
 * 使用方式：
 * npx ts-node scripts/import-preset-tags.ts
 * 或
 * npx tsx scripts/import-preset-tags.ts
 * 
 * 环境变量：
 * - ADMIN_API_KEY: 管理员密钥（必需）
 * - API_BASE_URL: API 基础 URL（默认 http://localhost:3001）
 * - OVERWRITE: 是否覆盖同名标签（默认 false）
 */

import * as fs from 'fs';
import * as path from 'path';

interface PresetTagsConfig {
  description?: string;
  tags: Array<{
    name: string;
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

interface BatchImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ name: string; reason: string }>;
}

async function importPresetTags(): Promise<void> {
  const adminKey = process.env.ADMIN_API_KEY;
  const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
  const overwrite = process.env.OVERWRITE === 'true';

  // 验证环境变量
  if (!adminKey) {
    console.error('❌ 错误: ADMIN_API_KEY 环境变量未设置');
    console.error('   请设置 ADMIN_API_KEY 后重试');
    process.exit(1);
  }

  // 读取配置文件
  const configPath = path.join(__dirname, '../prisma/preset-tags.json');
  
  if (!fs.existsSync(configPath)) {
    console.error(`❌ 错误: 找不到配置文件 ${configPath}`);
    process.exit(1);
  }

  console.log('📂 读取预置标签配置文件...');
  const configContent = fs.readFileSync(configPath, 'utf-8');
  const config: PresetTagsConfig = JSON.parse(configContent);

  if (!config.tags || config.tags.length === 0) {
    console.log('ℹ️  配置文件中没有标签数据');
    return;
  }

  console.log(`📊 找到 ${config.tags.length} 个预置标签:`);
  config.tags.forEach((tag, index) => {
    console.log(`   ${index + 1}. ${tag.icon || '📌'} ${tag.name}`);
  });

  // 构建请求体
  const requestBody = {
    tags: config.tags,
    overwrite,
  };

  console.log(`\n🚀 开始导入... (overwrite: ${overwrite})`);
  console.log(`   API: ${apiBaseUrl}/api/internal/tags/batch`);

  try {
    const response = await fetch(`${apiBaseUrl}/api/internal/tags/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result: BatchImportResult = await response.json();

    console.log('\n✅ 导入完成！');
    console.log('📈 导入统计:');
    console.log(`   - 创建: ${result.created} 个标签`);
    console.log(`   - 更新: ${result.updated} 个标签`);
    console.log(`   - 跳过: ${result.skipped} 个标签`);

    if (result.errors.length > 0) {
      console.log(`   - 错误: ${result.errors.length} 个`);
      result.errors.forEach(err => {
        console.log(`     ❌ ${err.name}: ${err.reason}`);
      });
    }
  } catch (error) {
    console.error('\n❌ 导入失败:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// 运行脚本
importPresetTags().catch(console.error);

/**
 * Venus API 模型探测脚本
 * 尝试不同的模型名称找到可用的
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const API_URL = process.env.NEXT_PUBLIC_VENUS_API_URL || 'http://v2.open.venus.oa.com/llmproxy/chat/completions';
const API_KEY = process.env.VENUS_API_KEY || '';

// 常见的模型名称格式
const modelsToTry = [
  'gpt-4',
  'gpt-4-turbo',
  'gpt-4-1106-preview',
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-16k',
  'deepseek-chat',
  'deepseek-coder',
  'DeepSeek-V3',
  'deepseek_v3',
  'claude-3-opus',
  'claude-3-sonnet',
  'hunyuan',
  'hunyuan-lite',
  'hunyuan-pro',
];

async function testModel(model: string): Promise<boolean> {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ ${model} - 可用! 回复: "${data.choices?.[0]?.message?.content?.substring(0, 50) || ''}..."`);
      return true;
    } else {
      const error = await response.json();
      console.log(`❌ ${model} - ${error?.error?.message || response.status}`);
      return false;
    }
  } catch (e) {
    console.log(`❌ ${model} - 请求失败`);
    return false;
  }
}

async function main() {
  console.log('🔍 Venus API 模型探测\n');
  console.log(`API: ${API_URL}`);
  console.log(`Key: ${API_KEY.substring(0, 10)}...\n`);

  console.log('正在测试各模型...\n');

  const availableModels: string[] = [];

  for (const model of modelsToTry) {
    const available = await testModel(model);
    if (available) {
      availableModels.push(model);
    }
    // 避免请求过快
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n========================================');
  if (availableModels.length > 0) {
    console.log(`\n✅ 可用模型: ${availableModels.join(', ')}`);
    console.log(`\n推荐使用: ${availableModels[0]}`);
  } else {
    console.log('\n❌ 未找到可用模型，请检查 Token 权限或联系管理员');
  }
}

main();

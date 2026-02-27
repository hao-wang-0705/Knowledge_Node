/**
 * Venus API 更多模型探测
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const API_URL = process.env.NEXT_PUBLIC_VENUS_API_URL || 'http://v2.open.venus.oa.com/llmproxy/chat/completions';
const API_KEY = process.env.VENUS_API_KEY || '';

// 更多模型名称
const modelsToTry = [
  // 混元系列
  'hunyuan-standard',
  'hunyuan-standard-256K',
  'hunyuan-turbo',
  'hunyuan-turbo-latest',
  'hunyuan-large',
  'hunyuan-large-longcontext',
  'hunyuan-code',
  'hunyuan-functioncall',
  'hunyuan-role',
  'hunyuan-vision',
  // DeepSeek 系列
  'deepseek-v3',
  'deepseek-r1',
  'deepseek-r1-distill-qwen-32b',
  // 其他
  'qwen-max',
  'qwen-plus',
  'qwen-turbo',
  'glm-4',
  'glm-3-turbo',
  'ernie-4.0',
  'ernie-3.5',
  'moonshot-v1-8k',
  'doubao-pro-32k',
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
      console.log(`✅ ${model} - 可用!`);
      return true;
    } else {
      const error = await response.json();
      const msg = error?.error?.message || String(response.status);
      // 只显示简短信息
      if (msg.includes('不存在')) {
        console.log(`❌ ${model} - 不存在`);
      } else if (msg.includes('无调用权限')) {
        console.log(`⚠️ ${model} - 需申请权限`);
      } else {
        console.log(`❌ ${model} - ${msg.substring(0, 40)}`);
      }
      return false;
    }
  } catch (e) {
    console.log(`❌ ${model} - 请求失败`);
    return false;
  }
}

async function main() {
  console.log('🔍 Venus API 模型探测 (扩展列表)\n');

  const availableModels: string[] = [];
  const needPermission: string[] = [];

  for (const model of modelsToTry) {
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
      console.log(`✅ ${model} - 可用!`);
      availableModels.push(model);
    } else {
      const error = await response.json();
      const msg = error?.error?.message || '';
      if (msg.includes('无调用权限') || msg.includes('已下线')) {
        console.log(`⚠️ ${model} - 需申请权限`);
        needPermission.push(model);
      } else if (msg.includes('不存在')) {
        console.log(`❌ ${model} - 不存在`);
      } else {
        console.log(`❌ ${model} - ${msg.substring(0, 50)}`);
      }
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n========================================');
  if (availableModels.length > 0) {
    console.log(`\n✅ 可用模型: ${availableModels.join(', ')}`);
  } else {
    console.log('\n❌ 暂无可用模型');
  }
  
  if (needPermission.length > 0) {
    console.log(`\n⚠️ 可申请权限的模型: ${needPermission.join(', ')}`);
    console.log('\n请前往 Venus 平台申请模型权限:');
    console.log('https://venus.woa.com/#/openapi/accountManage/personalAccount');
  }
}

main();

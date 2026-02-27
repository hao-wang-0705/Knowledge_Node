/**
 * Venus API 连通性测试脚本
 * 
 * 运行方式: npx tsx scripts/test-venus-api.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const API_URL = process.env.NEXT_PUBLIC_VENUS_API_URL || 'http://v2.open.venus.oa.com/llmproxy/chat/completions';
const API_KEY = process.env.VENUS_API_KEY || '';
const MODEL = process.env.NEXT_PUBLIC_VENUS_MODEL || 'hunyuan-turbo';

async function testAPI() {
  console.log('🔍 Venus API 连通性测试\n');
  console.log('配置信息:');
  console.log(`  - API URL: ${API_URL}`);
  console.log(`  - Model: ${MODEL}`);
  console.log(`  - API Key: ${API_KEY ? API_KEY.substring(0, 10) + '...' : '❌ 未配置'}`);
  console.log('');

  if (!API_KEY) {
    console.error('❌ 错误: VENUS_API_KEY 未配置');
    process.exit(1);
  }

  try {
    console.log('📡 发送测试请求...\n');
    
    const startTime = Date.now();
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: '请用一句话介绍你自己',
          },
        ],
        max_tokens: 100,
        temperature: 0.7,
      }),
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API 请求失败 (${response.status})`);
      console.error(`   错误信息: ${errorText}`);
      process.exit(1);
    }

    const data = await response.json();
    
    console.log('✅ API 连接成功!\n');
    console.log(`⏱️  响应延迟: ${latency}ms`);
    console.log(`📝 模型回复: ${data.choices?.[0]?.message?.content || '无内容'}`);
    console.log('');
    console.log('📊 Token 使用:');
    console.log(`   - Prompt tokens: ${data.usage?.prompt_tokens || 'N/A'}`);
    console.log(`   - Completion tokens: ${data.usage?.completion_tokens || 'N/A'}`);
    console.log(`   - Total tokens: ${data.usage?.total_tokens || 'N/A'}`);
    console.log('');
    console.log('🎉 Venus API 配置正确，可以正常使用！');

  } catch (error) {
    console.error('❌ 请求出错:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

testAPI();

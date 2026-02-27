/**
 * AI 服务功能测试
 * 
 * 测试各项 AI 功能是否正常工作
 * 运行: npx tsx scripts/test-ai-services.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const API_URL = process.env.NEXT_PUBLIC_VENUS_API_URL || 'http://v2.open.venus.oa.com/llmproxy/chat/completions';
const API_KEY = process.env.VENUS_API_KEY || '';
const MODEL = process.env.NEXT_PUBLIC_VENUS_MODEL || 'hunyuan-turbo';

// 简单的 API 调用封装
async function callAI(messages: any[], options: any = {}): Promise<string> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: options.max_tokens || 1024,
      temperature: options.temperature || 0.7,
      ...options,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error?.error?.message || `API Error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// 测试 1: 文本解析为树形结构
async function testParseText() {
  console.log('\n📝 测试 1: 文本解析为树形结构');
  
  const testText = `
项目计划
  - 需求分析
    - 用户调研
    - 功能定义
  - 技术设计
    - 架构设计
    - 数据库设计
  - 开发实现
`;

  const prompt = `请将以下文本解析为 JSON 树形结构。每个节点包含 content（内容）和 children（子节点数组）。

文本:
${testText}

请直接输出 JSON，不要添加任何解释：`;

  try {
    const result = await callAI([{ role: 'user', content: prompt }], { temperature: 0.1 });
    console.log('✅ 解析结果:');
    console.log(result.substring(0, 500) + '...');
    return true;
  } catch (e) {
    console.log('❌ 失败:', e instanceof Error ? e.message : e);
    return false;
  }
}

// 测试 2: 标签识别
async function testTagRecognition() {
  console.log('\n🏷️ 测试 2: 标签识别');
  
  const testContent = '明天下午三点和张三开会讨论产品需求';
  const availableTags = ['任务', '想法', '笔记', '会议', '日程', '待办'];

  const prompt = `根据以下内容，从可用标签中选择最合适的标签。

内容: "${testContent}"
可用标签: ${availableTags.join(', ')}

请只输出一个最合适的标签名称：`;

  try {
    const result = await callAI([{ role: 'user', content: prompt }], { temperature: 0.1 });
    console.log('✅ 识别结果:', result.trim());
    return true;
  } catch (e) {
    console.log('❌ 失败:', e instanceof Error ? e.message : e);
    return false;
  }
}

// 测试 3: 头脑风暴生成想法
async function testIdeaGeneration() {
  console.log('\n💡 测试 3: 头脑风暴生成想法');
  
  const parentContent = '如何提高工作效率';

  const prompt = `基于主题"${parentContent}"，生成 3 个相关的想法或建议。

请按以下 JSON 格式输出：
[
  { "content": "想法1", "reason": "简短理由" },
  { "content": "想法2", "reason": "简短理由" },
  { "content": "想法3", "reason": "简短理由" }
]

直接输出 JSON：`;

  try {
    const result = await callAI([{ role: 'user', content: prompt }], { temperature: 0.8 });
    console.log('✅ 生成结果:');
    console.log(result.substring(0, 500));
    return true;
  } catch (e) {
    console.log('❌ 失败:', e instanceof Error ? e.message : e);
    return false;
  }
}

// 测试 4: 意图路由（Function Calling 模拟）
async function testIntentRouting() {
  console.log('\n🎯 测试 4: 意图路由');
  
  const testQueries = [
    '搜索 TypeScript 最佳实践',
    '帮我展开这个想法',
    '翻译成英文：你好世界',
    '按周汇总我的任务',
  ];

  const prompt = `分析以下用户查询，识别其意图类型。
可能的意图类型：
- WEB_SEARCH: 网络搜索
- TRANSLATE: 翻译
- EXPAND: 展开/扩展内容
- SUMMARIZE: 总结
- TIME_AGGREGATION: 时间聚合（日/周/月汇总）
- UNKNOWN: 无法识别

查询列表:
${testQueries.map((q, i) => `${i + 1}. "${q}"`).join('\n')}

请按以下 JSON 格式输出每个查询的意图：
[
  { "query": "查询1", "intent": "意图类型" },
  ...
]`;

  try {
    const result = await callAI([{ role: 'user', content: prompt }], { temperature: 0.1 });
    console.log('✅ 意图识别结果:');
    console.log(result);
    return true;
  } catch (e) {
    console.log('❌ 失败:', e instanceof Error ? e.message : e);
    return false;
  }
}

// 测试 5: 流式输出
async function testStreaming() {
  console.log('\n🌊 测试 5: 流式输出');
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: '用三句话介绍人工智能' }],
        max_tokens: 200,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    console.log('✅ 流式响应:');
    process.stdout.write('   ');
    
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    if (reader) {
      let fullText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'));
        
        for (const line of lines) {
          const data = line.replace('data:', '').trim();
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              process.stdout.write(content);
              fullText += content;
            }
          } catch {}
        }
      }
      console.log('\n');
    }
    return true;
  } catch (e) {
    console.log('❌ 失败:', e instanceof Error ? e.message : e);
    return false;
  }
}

// 主函数
async function main() {
  console.log('🧪 AI 服务功能测试\n');
  console.log('配置:');
  console.log(`  - Model: ${MODEL}`);
  console.log(`  - API: ${API_URL}`);
  console.log('');

  const results = {
    parseText: await testParseText(),
    tagRecognition: await testTagRecognition(),
    ideaGeneration: await testIdeaGeneration(),
    intentRouting: await testIntentRouting(),
    streaming: await testStreaming(),
  };

  console.log('\n========================================');
  console.log('📊 测试结果汇总:\n');
  
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([name, result]) => {
    console.log(`  ${result ? '✅' : '❌'} ${name}`);
  });
  
  console.log(`\n总计: ${passed}/${total} 通过`);
  
  if (passed === total) {
    console.log('\n🎉 所有测试通过！AI 服务已就绪！');
  } else {
    console.log('\n⚠️ 部分测试失败，请检查配置');
  }
}

main();

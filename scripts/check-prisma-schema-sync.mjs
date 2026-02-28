#!/usr/bin/env node
/**
 * 校验 knowledge-node-nextjs 与 knowledge-node-backend 的 Prisma schema 是否一致。
 * 规范化：仅比较 model 定义，忽略空白与模型顺序。
 * 用法：从仓库根目录执行 node scripts/check-prisma-schema-sync.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const NEXTJS_SCHEMA = path.join(ROOT, 'knowledge-node-nextjs', 'prisma', 'schema.prisma');
const BACKEND_SCHEMA = path.join(ROOT, 'knowledge-node-backend', 'prisma', 'schema.prisma');

function extractModels(content) {
  const models = [];
  const modelRegex = /model\s+(\w+)\s*\{/g;
  let match;
  while ((match = modelRegex.exec(content)) !== null) {
    const name = match[1];
    const start = match.index;
    let depth = 0;
    let end = start;
    for (let i = start; i < content.length; i++) {
      if (content[i] === '{') depth++;
      if (content[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    models.push({ name, body: content.slice(start, end) });
  }
  return models;
}

function normalize(block) {
  return block
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}])\s*/g, '$1')
    .trim();
}

function main() {
  const nextjsPath = NEXTJS_SCHEMA;
  const backendPath = BACKEND_SCHEMA;

  if (!fs.existsSync(nextjsPath)) {
    console.error('Missing:', nextjsPath);
    process.exit(2);
  }
  if (!fs.existsSync(backendPath)) {
    console.error('Missing:', backendPath);
    process.exit(2);
  }

  const nextjsContent = fs.readFileSync(nextjsPath, 'utf8');
  const backendContent = fs.readFileSync(backendPath, 'utf8');

  const nextjsModels = extractModels(nextjsContent).sort((a, b) => a.name.localeCompare(b.name));
  const backendModels = extractModels(backendContent).sort((a, b) => a.name.localeCompare(b.name));

  const nextjsNames = new Set(nextjsModels.map((m) => m.name));
  const backendNames = new Set(backendModels.map((m) => m.name));

  if (nextjsNames.size !== backendNames.size || [...nextjsNames].some((n) => !backendNames.has(n))) {
    const onlyNext = [...nextjsNames].filter((n) => !backendNames.has(n));
    const onlyBackend = [...backendNames].filter((n) => !nextjsNames.has(n));
    console.error('Schema model set mismatch.');
    if (onlyNext.length) console.error('  Only in nextjs:', onlyNext.join(', '));
    if (onlyBackend.length) console.error('  Only in backend:', onlyBackend.join(', '));
    process.exit(1);
  }

  for (const nextModel of nextjsModels) {
    const backModel = backendModels.find((m) => m.name === nextModel.name);
    const n = normalize(nextModel.body);
    const b = normalize(backModel.body);
    if (n !== b) {
      console.error(`Model "${nextModel.name}" differs between nextjs and backend.`);
      process.exit(1);
    }
  }

  console.log('OK: Prisma schemas are in sync (nextjs vs backend).');
  process.exit(0);
}

main();

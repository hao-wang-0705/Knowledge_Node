/**
 * 重建 MENTION 边：
 * - 清空现有 MENTION 边
 * - 从节点 references + fields({ nodeId }) 重新生成 source -> target 的提及关系
 *
 * 使用方式：
 *   npx ts-node scripts/backfill-mentions-from-references.ts
 *   npx tsx scripts/backfill-mentions-from-references.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function extractTargetsFromReferences(references: unknown): string[] {
  if (!Array.isArray(references)) return [];
  return references
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const targetNodeId = (item as { targetNodeId?: unknown }).targetNodeId;
      return typeof targetNodeId === 'string' && targetNodeId.trim() ? targetNodeId.trim() : null;
    })
    .filter((id): id is string => !!id);
}

function extractTargetsFromFields(fields: Record<string, unknown>): string[] {
  const targets: string[] = [];
  for (const value of Object.values(fields ?? {})) {
    if (!value) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      const nodeId = (value as { nodeId?: unknown }).nodeId;
      if (typeof nodeId === 'string' && nodeId.trim()) {
        targets.push(nodeId.trim());
      }
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (!item || typeof item !== 'object') continue;
        const nodeId = (item as { nodeId?: unknown }).nodeId;
        if (typeof nodeId === 'string' && nodeId.trim()) {
          targets.push(nodeId.trim());
        }
      }
    }
  }
  return targets;
}

async function main() {
  const mentionType = 'MENTION' as any;

  const nodes = await prisma.node.findMany({
    where: { nodeRole: 'normal' },
    select: {
      id: true,
      logicalId: true,
      userId: true,
      references: true,
      fields: true,
    },
  });

  if (nodes.length === 0) {
    console.log('[backfill-mentions] 无普通节点，跳过');
    return;
  }

  await prisma.networkEdge.deleteMany({
    where: { edgeType: mentionType },
  });

  const userLogicalMap = new Map<string, Map<string, string>>();
  for (const node of nodes) {
    const map = userLogicalMap.get(node.userId) ?? new Map<string, string>();
    map.set(node.logicalId, node.id);
    userLogicalMap.set(node.userId, map);
  }

  let created = 0;
  let skipped = 0;

  for (const source of nodes) {
    const fields = (source.fields as Record<string, unknown>) ?? {};
    const targets = [...new Set([
      ...extractTargetsFromReferences(source.references),
      ...extractTargetsFromFields(fields),
    ])].filter((targetLogicalId) => targetLogicalId !== source.logicalId);

    if (targets.length === 0) continue;

    const logicalToPhysical = userLogicalMap.get(source.userId) ?? new Map<string, string>();
    for (const targetLogicalId of targets) {
      const targetPhysicalId = logicalToPhysical.get(targetLogicalId);
      if (!targetPhysicalId) {
        skipped++;
        continue;
      }
      await prisma.networkEdge.upsert({
        where: {
          sourceNodeId_targetNodeId_edgeType: {
            sourceNodeId: source.id,
            targetNodeId: targetPhysicalId,
            edgeType: mentionType,
          },
        },
        create: {
          sourceNodeId: source.id,
          targetNodeId: targetPhysicalId,
          edgeType: mentionType,
        },
        update: {},
      });
      created++;
    }
  }

  console.log(`[backfill-mentions] 完成: 创建/保留 ${created} 条 MENTION 边，跳过 ${skipped} 条无效目标`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

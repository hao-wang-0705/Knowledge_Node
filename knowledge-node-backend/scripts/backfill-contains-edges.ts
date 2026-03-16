/**
 * 切边数据迁移：将现有 Node.parentId 全量转为 CONTAINS 边
 * 含 user_root → daily_root 及普通父子关系。
 *
 * 使用方式（在 schema 迁移已执行后）：
 *   npx ts-node scripts/backfill-contains-edges.ts
 *   npx tsx scripts/backfill-contains-edges.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const nodesWithParent = await prisma.node.findMany({
    where: { parentId: { not: null } },
    select: { id: true, parentId: true },
  });

  if (nodesWithParent.length === 0) {
    console.log('[backfill-contains-edges] 无 parentId 非空节点，跳过');
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const node of nodesWithParent) {
    const parentId = node.parentId!;
    try {
      await prisma.networkEdge.upsert({
        where: {
          sourceNodeId_targetNodeId_edgeType: {
            sourceNodeId: parentId,
            targetNodeId: node.id,
            edgeType: 'CONTAINS',
          },
        },
        create: {
          sourceNodeId: parentId,
          targetNodeId: node.id,
          edgeType: 'CONTAINS',
        },
        update: {},
      });
      created++;
    } catch (e: any) {
      if (e?.code === 'P2003') {
        console.warn(`[backfill] 跳过：父节点 ${parentId} 不存在，子节点 ${node.id}`);
        skipped++;
      } else {
        throw e;
      }
    }
  }

  console.log(`[backfill-contains-edges] 完成: 创建/保留 ${created} 条 CONTAINS 边，跳过 ${skipped} 条`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

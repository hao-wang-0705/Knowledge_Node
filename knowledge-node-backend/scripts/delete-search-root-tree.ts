/**
 * 一次性清理：删除所有用户的 search_root 节点及其整棵子树。
 * search_root 为已废弃的“智能查询”容器节点，其子节点为原左侧智能查询面板中的搜索节点；
 * 产品已移除该面板，仅保留大纲内的“搜索节点”功能（type=search），故需清理历史数据。
 *
 * 使用方式（在项目根目录或 backend 目录）：
 *   npx ts-node scripts/delete-search-root-tree.ts
 *   npx tsx scripts/delete-search-root-tree.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const searchRoots = await prisma.node.findMany({
    where: { nodeRole: 'search_root' },
    select: { id: true, userId: true, logicalId: true },
  });

  if (searchRoots.length === 0) {
    console.log('[delete-search-root-tree] 未发现 search_root 节点，无需清理');
    return;
  }

  const rootIds = new Set(searchRoots.map((r) => r.id));
  const allIdsToDelete = new Set<string>(rootIds);

  // 收集所有后代节点 ID（按 parentId 递归）
  let currentLevel = [...rootIds];
  while (currentLevel.length > 0) {
    const children = await prisma.node.findMany({
      where: { parentId: { in: currentLevel } },
      select: { id: true },
    });
    const childIds = children.map((c) => c.id);
    currentLevel = childIds.filter((id) => !allIdsToDelete.has(id));
    currentLevel.forEach((id) => allIdsToDelete.add(id));
  }

  const total = allIdsToDelete.size;
  const subtreeCount = total - rootIds.size;

  const { count } = await prisma.node.deleteMany({
    where: { id: { in: [...allIdsToDelete] } },
  });

  console.log(`[delete-search-root-tree] 已删除 ${count} 个节点（其中 search_root: ${rootIds.size}，子节点: ${subtreeCount}）`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

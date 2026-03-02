/**
 * 删除数据库中所有孤儿节点，保证数据纯净。
 *
 * 孤儿节点定义：
 * 1. 悬空引用：parentId 非空但父节点不存在
 * 2. 错误根节点：parentId 为空且 nodeRole 不是 user_root（本应挂在 user_root 下但因 bug 被存成根节点）
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. 悬空引用：父节点不存在的节点
  const dangling = await prisma.node.findMany({
    where: {
      parentId: { not: null },
      parent: null,
    },
    select: { id: true, parentId: true, userId: true },
  });

  if (dangling.length > 0) {
    const { count } = await prisma.node.deleteMany({
      where: { id: { in: dangling.map((d) => d.id) } },
    });
    console.log(`[删除悬空引用] 已删除 ${count} 个父节点不存在的节点`);
  } else {
    console.log('[删除悬空引用] 无此类节点');
  }

  // 2. 错误根节点：parentId 为空且不是 user_root（应为 user_root 子节点却被存成根）
  const orphanRoots = await prisma.node.deleteMany({
    where: {
      parentId: null,
      nodeRole: { not: 'user_root' },
    },
  });

  if (orphanRoots.count > 0) {
    console.log(`[删除错误根节点] 已删除 ${orphanRoots.count} 个孤儿根节点`);
  } else {
    console.log('[删除错误根节点] 无此类节点');
  }

  const totalDeleted = (dangling.length > 0 ? dangling.length : 0) + orphanRoots.count;
  console.log(`\n合计删除孤儿节点: ${totalDeleted} 个`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

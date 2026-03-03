/**
 * 日历节点修复 API
 * 根据诊断结果批量修复损坏的日历节点 parentId
 * 使用事务确保原子性
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

interface RepairItem {
  nodeId: string;
  expectedParentId: string | null;
}

interface RepairRequest {
  items: RepairItem[];
  dryRun?: boolean;
}

interface RepairResult {
  nodeId: string;
  oldParentId: string | null;
  newParentId: string | null;
  success: boolean;
  error?: string;
}

interface RepairReport {
  userId: string;
  repairedAt: string;
  dryRun: boolean;
  summary: {
    totalRequested: number;
    successCount: number;
    failedCount: number;
    skippedCount: number;
  };
  results: RepairResult[];
}

// 防重入锁
const repairLocks = new Map<string, boolean>();

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // 检查是否有正在进行的修复
    if (repairLocks.get(userId)) {
      return NextResponse.json(
        { error: 'Repair already in progress for this user' },
        { status: 409 }
      );
    }

    const body: RepairRequest = await request.json();
    const { items, dryRun = false } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: items array is required' },
        { status: 400 }
      );
    }

    // 限制单次修复数量
    if (items.length > 500) {
      return NextResponse.json(
        { error: 'Too many items: maximum 500 items per request' },
        { status: 400 }
      );
    }

    // 设置锁
    repairLocks.set(userId, true);

    try {
      const results: RepairResult[] = [];
      let successCount = 0;
      let failedCount = 0;
      let skippedCount = 0;

      // 验证所有节点属于当前用户
      const nodeIds = items.map((item) => item.nodeId);
      const existingNodes = await prisma.node.findMany({
        where: {
          id: { in: nodeIds },
          userId,
        },
        select: {
          id: true,
          parentId: true,
        },
      });

      const existingNodeMap = new Map(existingNodes.map((n) => [n.id, n]));

      if (dryRun) {
        // 干运行：只返回将要执行的更改
        for (const item of items) {
          const existingNode = existingNodeMap.get(item.nodeId);
          if (!existingNode) {
            results.push({
              nodeId: item.nodeId,
              oldParentId: null,
              newParentId: item.expectedParentId,
              success: false,
              error: 'Node not found or not owned by user',
            });
            skippedCount++;
            continue;
          }

          if (existingNode.parentId === item.expectedParentId) {
            results.push({
              nodeId: item.nodeId,
              oldParentId: existingNode.parentId,
              newParentId: item.expectedParentId,
              success: true,
              error: 'Already correct (no change needed)',
            });
            skippedCount++;
            continue;
          }

          results.push({
            nodeId: item.nodeId,
            oldParentId: existingNode.parentId,
            newParentId: item.expectedParentId,
            success: true,
          });
          successCount++;
        }
      } else {
        // 实际修复：使用事务
        const updateOperations: Array<{
          nodeId: string;
          expectedParentId: string | null;
          oldParentId: string | null;
        }> = [];

        for (const item of items) {
          const existingNode = existingNodeMap.get(item.nodeId);
          if (!existingNode) {
            results.push({
              nodeId: item.nodeId,
              oldParentId: null,
              newParentId: item.expectedParentId,
              success: false,
              error: 'Node not found or not owned by user',
            });
            failedCount++;
            continue;
          }

          if (existingNode.parentId === item.expectedParentId) {
            results.push({
              nodeId: item.nodeId,
              oldParentId: existingNode.parentId,
              newParentId: item.expectedParentId,
              success: true,
              error: 'Already correct (no change needed)',
            });
            skippedCount++;
            continue;
          }

          updateOperations.push({
            nodeId: item.nodeId,
            expectedParentId: item.expectedParentId,
            oldParentId: existingNode.parentId,
          });
        }

        // 使用事务批量更新
        if (updateOperations.length > 0) {
          try {
            await prisma.$transaction(
              updateOperations.map((op) =>
                prisma.node.update({
                  where: { id: op.nodeId },
                  data: { parentId: op.expectedParentId },
                })
              )
            );

            // 所有更新成功
            for (const op of updateOperations) {
              results.push({
                nodeId: op.nodeId,
                oldParentId: op.oldParentId,
                newParentId: op.expectedParentId,
                success: true,
              });
              successCount++;
            }

            console.log(
              `[calendar-repair] User ${userId}: Successfully repaired ${updateOperations.length} nodes`
            );
          } catch (txError) {
            // 事务失败
            console.error('[calendar-repair] Transaction failed:', txError);
            for (const op of updateOperations) {
              results.push({
                nodeId: op.nodeId,
                oldParentId: op.oldParentId,
                newParentId: op.expectedParentId,
                success: false,
                error: `Transaction failed: ${String(txError)}`,
              });
              failedCount++;
            }
          }
        }
      }

      const report: RepairReport = {
        userId,
        repairedAt: new Date().toISOString(),
        dryRun,
        summary: {
          totalRequested: items.length,
          successCount,
          failedCount,
          skippedCount,
        },
        results,
      };

      return NextResponse.json(report);
    } finally {
      // 释放锁
      repairLocks.delete(userId);
    }
  } catch (error) {
    console.error('[calendar-repair] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

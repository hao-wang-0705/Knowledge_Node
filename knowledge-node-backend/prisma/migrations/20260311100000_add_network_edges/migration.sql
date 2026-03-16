-- 拓扑边表：节点间多对多有向关系（DAG）
-- 切边后树结构由 CONTAINS 表达，BLOCKS/RESOLVES 表达业务依赖

-- CreateEnum
CREATE TYPE "EdgeType" AS ENUM ('CONTAINS', 'BLOCKS', 'RESOLVES');

-- CreateTable
CREATE TABLE "network_edges" (
    "id" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "edgeType" "EdgeType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "network_edges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "network_edges_sourceNodeId_targetNodeId_edgeType_key" ON "network_edges"("sourceNodeId", "targetNodeId", "edgeType");
CREATE INDEX "network_edges_sourceNodeId_idx" ON "network_edges"("sourceNodeId");
CREATE INDEX "network_edges_targetNodeId_idx" ON "network_edges"("targetNodeId");
CREATE INDEX "network_edges_edgeType_idx" ON "network_edges"("edgeType");

-- AddForeignKey (cascade delete when node is removed)
ALTER TABLE "network_edges" ADD CONSTRAINT "network_edges_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "network_edges" ADD CONSTRAINT "network_edges_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

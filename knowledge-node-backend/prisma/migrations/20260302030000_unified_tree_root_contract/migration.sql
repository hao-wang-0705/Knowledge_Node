-- Unified tree contract (stage 2):
-- 1) add nodeRole to express structural root semantics
-- 2) add notebook.rootNodeId foreign key to node.id for referential safety

ALTER TABLE "nodes"
ADD COLUMN "nodeRole" TEXT NOT NULL DEFAULT 'normal';

CREATE INDEX "nodes_userId_nodeRole_parentId_idx"
ON "nodes"("userId", "nodeRole", "parentId");

CREATE INDEX "nodes_notebookId_nodeRole_idx"
ON "nodes"("notebookId", "nodeRole");

CREATE INDEX "notebooks_rootNodeId_idx"
ON "notebooks"("rootNodeId");

ALTER TABLE "notebooks"
ADD CONSTRAINT "notebooks_rootNodeId_fkey"
FOREIGN KEY ("rootNodeId") REFERENCES "nodes"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

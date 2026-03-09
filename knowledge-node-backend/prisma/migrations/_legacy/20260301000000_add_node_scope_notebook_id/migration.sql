-- AlterTable (ADR-005 tree isolation: scope + notebookId)
ALTER TABLE "nodes" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'general';
ALTER TABLE "nodes" ADD COLUMN "notebookId" TEXT;

-- CreateIndex
CREATE INDEX "nodes_userId_scope_parentId_sortOrder_idx" ON "nodes"("userId", "scope", "parentId", "sortOrder");
CREATE INDEX "nodes_userId_notebookId_parentId_sortOrder_idx" ON "nodes"("userId", "notebookId", "parentId", "sortOrder");

-- AddForeignKey
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "notebooks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

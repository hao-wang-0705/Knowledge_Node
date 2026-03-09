-- Add logicalId column to nodes table
-- This column provides a stable, human-readable identifier for nodes (e.g., "daily-root-userId", "day-2026-03-04")

-- 1. Add logicalId column with a default value based on id
ALTER TABLE "nodes" ADD COLUMN IF NOT EXISTS "logicalId" TEXT;

-- 2. Backfill existing nodes: use id as logicalId for existing records
UPDATE "nodes" SET "logicalId" = "id" WHERE "logicalId" IS NULL;

-- 3. Make logicalId NOT NULL after backfill
ALTER TABLE "nodes" ALTER COLUMN "logicalId" SET NOT NULL;

-- 4. Create unique composite index on (userId, logicalId)
CREATE UNIQUE INDEX IF NOT EXISTS "nodes_userId_logicalId_key" ON "nodes"("userId", "logicalId");

-- 5. Create index for faster lookups
CREATE INDEX IF NOT EXISTS "nodes_userId_logicalId_idx" ON "nodes"("userId", "logicalId");

-- 6. Create composite index for sorting queries
CREATE INDEX IF NOT EXISTS "nodes_userId_parentId_sortOrder_idx" ON "nodes"("userId", "parentId", "sortOrder");

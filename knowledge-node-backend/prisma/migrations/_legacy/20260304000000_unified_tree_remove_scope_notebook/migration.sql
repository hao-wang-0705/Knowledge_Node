-- Unified tree: migrate notebook_root to normal, preserve notebook icon in payload, drop scope/notebookId and Notebook table

-- 1. notebook_root nodes become normal (they remain first-level children of user_root)
UPDATE "nodes" SET "nodeRole" = 'normal' WHERE "nodeRole" = 'notebook_root';

-- 2. Copy notebook icon into node payload for nodes that were notebook roots (name already in content)
UPDATE "nodes" n
SET payload = jsonb_set(
  COALESCE(n.payload::jsonb, '{}'::jsonb),
  '{icon}',
  to_jsonb(nb.icon::text)
)
FROM "notebooks" nb
WHERE nb."rootNodeId" = n.id AND nb.icon IS NOT NULL;

-- 3. Drop FK from nodes to notebooks before dropping columns (camelCase from 20260301 + snake_case from init)
ALTER TABLE "nodes" DROP CONSTRAINT IF EXISTS "nodes_notebookId_fkey";
ALTER TABLE "nodes" DROP CONSTRAINT IF EXISTS "nodes_notebook_id_fkey";

-- 4. Drop indexes that reference scope or notebookId
DROP INDEX IF EXISTS "nodes_userId_scope_parentId_sortOrder_idx";
DROP INDEX IF EXISTS "nodes_userId_notebookId_parentId_sortOrder_idx";
DROP INDEX IF EXISTS "nodes_notebookId_nodeRole_idx";

-- 5. Drop scope and notebookId/notebook_id columns from nodes
ALTER TABLE "nodes" DROP COLUMN IF EXISTS "scope";
ALTER TABLE "nodes" DROP COLUMN IF EXISTS "notebookId";
ALTER TABLE "nodes" DROP COLUMN IF EXISTS "notebook_id";

-- 6. Drop notebooks table (no longer used; "notebook" is just a first-level child of user_root)
DROP TABLE IF EXISTS "notebooks";

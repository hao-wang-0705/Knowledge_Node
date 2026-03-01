-- Align legacy backend migration schema with current Prisma schema

-- users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isInitialized" BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'created_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'createdAt'
  ) THEN
    EXECUTE 'ALTER TABLE "users" RENAME COLUMN "created_at" TO "createdAt"';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'updated_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'updatedAt'
  ) THEN
    EXECUTE 'ALTER TABLE "users" RENAME COLUMN "updated_at" TO "updatedAt"';
  END IF;
END $$;

UPDATE "users"
SET "email" = CONCAT('user-', "id", '@knowledge-node.local')
WHERE "email" IS NULL;

ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;

-- nodes
ALTER TABLE "nodes" ADD COLUMN IF NOT EXISTS "payload" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "nodes" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nodes' AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nodes' AND column_name = 'userId'
  ) THEN
    EXECUTE 'ALTER TABLE "nodes" RENAME COLUMN "user_id" TO "userId"';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nodes' AND column_name = 'parent_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nodes' AND column_name = 'parentId'
  ) THEN
    EXECUTE 'ALTER TABLE "nodes" RENAME COLUMN "parent_id" TO "parentId"';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nodes' AND column_name = 'type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nodes' AND column_name = 'nodeType'
  ) THEN
    EXECUTE 'ALTER TABLE "nodes" RENAME COLUMN "type" TO "nodeType"';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nodes' AND column_name = 'supertag_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nodes' AND column_name = 'supertagId'
  ) THEN
    EXECUTE 'ALTER TABLE "nodes" RENAME COLUMN "supertag_id" TO "supertagId"';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nodes' AND column_name = 'is_collapsed'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nodes' AND column_name = 'isCollapsed'
  ) THEN
    EXECUTE 'ALTER TABLE "nodes" RENAME COLUMN "is_collapsed" TO "isCollapsed"';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nodes' AND column_name = 'created_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nodes' AND column_name = 'createdAt'
  ) THEN
    EXECUTE 'ALTER TABLE "nodes" RENAME COLUMN "created_at" TO "createdAt"';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nodes' AND column_name = 'updated_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nodes' AND column_name = 'updatedAt'
  ) THEN
    EXECUTE 'ALTER TABLE "nodes" RENAME COLUMN "updated_at" TO "updatedAt"';
  END IF;
END $$;

-- notebooks
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notebooks' AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notebooks' AND column_name = 'userId'
  ) THEN
    EXECUTE 'ALTER TABLE "notebooks" RENAME COLUMN "user_id" TO "userId"';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notebooks' AND column_name = 'root_node_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notebooks' AND column_name = 'rootNodeId'
  ) THEN
    EXECUTE 'ALTER TABLE "notebooks" RENAME COLUMN "root_node_id" TO "rootNodeId"';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notebooks' AND column_name = 'created_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notebooks' AND column_name = 'createdAt'
  ) THEN
    EXECUTE 'ALTER TABLE "notebooks" RENAME COLUMN "created_at" TO "createdAt"';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notebooks' AND column_name = 'updated_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notebooks' AND column_name = 'updatedAt'
  ) THEN
    EXECUTE 'ALTER TABLE "notebooks" RENAME COLUMN "updated_at" TO "updatedAt"';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notebooks' AND column_name = 'rootNodeId'
  ) THEN
    EXECUTE 'ALTER TABLE "notebooks" ALTER COLUMN "rootNodeId" DROP NOT NULL';
  END IF;
END $$;

-- supertags
ALTER TABLE "supertags" ADD COLUMN IF NOT EXISTS "categoryId" TEXT NOT NULL DEFAULT 'cat_uncategorized';
ALTER TABLE "supertags" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "supertags" ADD COLUMN IF NOT EXISTS "templateContent" JSONB;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supertags' AND column_name = 'category'
  ) THEN
    EXECUTE 'UPDATE "supertags" SET "categoryId" = COALESCE(NULLIF("category", ''''), ''cat_uncategorized'') WHERE "categoryId" = ''cat_uncategorized''';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supertags' AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supertags' AND column_name = 'userId'
  ) THEN
    EXECUTE 'ALTER TABLE "supertags" RENAME COLUMN "user_id" TO "userId"';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supertags' AND column_name = 'is_system'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supertags' AND column_name = 'isSystem'
  ) THEN
    EXECUTE 'ALTER TABLE "supertags" RENAME COLUMN "is_system" TO "isSystem"';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supertags' AND column_name = 'parent_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supertags' AND column_name = 'parentId'
  ) THEN
    EXECUTE 'ALTER TABLE "supertags" RENAME COLUMN "parent_id" TO "parentId"';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supertags' AND column_name = 'created_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supertags' AND column_name = 'createdAt'
  ) THEN
    EXECUTE 'ALTER TABLE "supertags" RENAME COLUMN "created_at" TO "createdAt"';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supertags' AND column_name = 'updated_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supertags' AND column_name = 'updatedAt'
  ) THEN
    EXECUTE 'ALTER TABLE "supertags" RENAME COLUMN "updated_at" TO "updatedAt"';
  END IF;
END $$;

-- categories / user_settings
CREATE TABLE IF NOT EXISTS "categories" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "icon" TEXT NOT NULL DEFAULT '📂',
  "color" TEXT NOT NULL DEFAULT '#6B7280',
  "description" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_settings" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- indexes
CREATE INDEX IF NOT EXISTS "nodes_userId_idx" ON "nodes"("userId");
CREATE INDEX IF NOT EXISTS "nodes_parentId_idx" ON "nodes"("parentId");
CREATE INDEX IF NOT EXISTS "nodes_supertagId_idx" ON "nodes"("supertagId");
CREATE INDEX IF NOT EXISTS "nodes_nodeType_idx" ON "nodes"("nodeType");
CREATE INDEX IF NOT EXISTS "nodes_createdAt_idx" ON "nodes"("createdAt");

CREATE INDEX IF NOT EXISTS "notebooks_userId_idx" ON "notebooks"("userId");

CREATE INDEX IF NOT EXISTS "supertags_userId_idx" ON "supertags"("userId");
CREATE INDEX IF NOT EXISTS "supertags_parentId_idx" ON "supertags"("parentId");
CREATE INDEX IF NOT EXISTS "supertags_categoryId_idx" ON "supertags"("categoryId");

CREATE INDEX IF NOT EXISTS "categories_userId_idx" ON "categories"("userId");
CREATE INDEX IF NOT EXISTS "user_settings_userId_idx" ON "user_settings"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "supertags_userId_name_key" ON "supertags"("userId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "categories_userId_id_key" ON "categories"("userId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "user_settings_userId_key_key" ON "user_settings"("userId", "key");

DROP INDEX IF EXISTS "user_settings_userId_key";

-- foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nodes_parentId_fkey'
  ) THEN
    ALTER TABLE "nodes"
    ADD CONSTRAINT "nodes_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supertags_parentId_fkey'
  ) THEN
    ALTER TABLE "supertags"
    ADD CONSTRAINT "supertags_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "supertags"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_userId_fkey'
  ) THEN
    ALTER TABLE "categories"
    ADD CONSTRAINT "categories_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_userId_fkey'
  ) THEN
    ALTER TABLE "user_settings"
    ADD CONSTRAINT "user_settings_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

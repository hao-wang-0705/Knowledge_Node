-- Knowledge Node 数据库基线迁移
-- 版本: v3.5
-- 生成时间: 2026-03-06
-- 说明: 此文件包含完整的数据库结构，新部署时一次性创建所有表

-- ============================================
-- 1. 用户表 (users)
-- ============================================
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "isInitialized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- 用户表唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

-- ============================================
-- 2. 标签模板表 (tag_templates)
-- ============================================
CREATE TABLE IF NOT EXISTS "tag_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366F1',
    "icon" TEXT,
    "description" TEXT,
    "fieldDefinitions" JSONB NOT NULL DEFAULT '[]',
    "isGlobalDefault" BOOLEAN NOT NULL DEFAULT true,
    "creatorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "order" INTEGER NOT NULL DEFAULT 0,
    "templateContent" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tag_templates_pkey" PRIMARY KEY ("id")
);

-- 标签模板表索引
CREATE INDEX IF NOT EXISTS "tag_templates_isGlobalDefault_status_idx" ON "tag_templates"("isGlobalDefault", "status");
CREATE INDEX IF NOT EXISTS "tag_templates_creatorId_idx" ON "tag_templates"("creatorId");

-- ============================================
-- 3. 节点表 (nodes)
-- ============================================
CREATE TABLE IF NOT EXISTS "nodes" (
    "id" TEXT NOT NULL,
    "logicalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "content" TEXT NOT NULL DEFAULT '',
    "nodeType" TEXT NOT NULL DEFAULT 'text',
    "nodeRole" TEXT NOT NULL DEFAULT 'normal',
    "supertagId" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "fields" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "references" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCollapsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nodes_pkey" PRIMARY KEY ("id")
);

-- 节点表唯一约束
CREATE UNIQUE INDEX IF NOT EXISTS "nodes_userId_logicalId_key" ON "nodes"("userId", "logicalId");

-- 节点表索引
CREATE INDEX IF NOT EXISTS "nodes_userId_idx" ON "nodes"("userId");
CREATE INDEX IF NOT EXISTS "nodes_userId_logicalId_idx" ON "nodes"("userId", "logicalId");
CREATE INDEX IF NOT EXISTS "nodes_parentId_idx" ON "nodes"("parentId");
CREATE INDEX IF NOT EXISTS "nodes_supertagId_idx" ON "nodes"("supertagId");
CREATE INDEX IF NOT EXISTS "nodes_nodeType_idx" ON "nodes"("nodeType");
CREATE INDEX IF NOT EXISTS "nodes_createdAt_idx" ON "nodes"("createdAt");
CREATE INDEX IF NOT EXISTS "nodes_userId_nodeRole_parentId_idx" ON "nodes"("userId", "nodeRole", "parentId");
CREATE INDEX IF NOT EXISTS "nodes_userId_parentId_sortOrder_idx" ON "nodes"("userId", "parentId", "sortOrder");

-- ============================================
-- 4. 用户标签库映射表 (user_tag_library)
-- ============================================
CREATE TABLE IF NOT EXISTS "user_tag_library" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tagTemplateId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_tag_library_pkey" PRIMARY KEY ("id")
);

-- 用户标签库唯一约束
CREATE UNIQUE INDEX IF NOT EXISTS "user_tag_library_userId_tagTemplateId_key" ON "user_tag_library"("userId", "tagTemplateId");

-- 用户标签库索引
CREATE INDEX IF NOT EXISTS "user_tag_library_userId_idx" ON "user_tag_library"("userId");
CREATE INDEX IF NOT EXISTS "user_tag_library_tagTemplateId_idx" ON "user_tag_library"("tagTemplateId");

-- ============================================
-- 5. 用户设置表 (user_settings)
-- ============================================
CREATE TABLE IF NOT EXISTS "user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- 用户设置唯一约束
CREATE UNIQUE INDEX IF NOT EXISTS "user_settings_userId_key_key" ON "user_settings"("userId", "key");

-- 用户设置索引
CREATE INDEX IF NOT EXISTS "user_settings_userId_idx" ON "user_settings"("userId");

-- ============================================
-- 6. 外键约束
-- ============================================

-- tag_templates -> users (creatorId)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tag_templates_creatorId_fkey'
    ) THEN
        ALTER TABLE "tag_templates" 
        ADD CONSTRAINT "tag_templates_creatorId_fkey" 
        FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- nodes -> users (userId)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'nodes_userId_fkey'
    ) THEN
        ALTER TABLE "nodes" 
        ADD CONSTRAINT "nodes_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- nodes -> nodes (parentId, 自引用)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'nodes_parentId_fkey'
    ) THEN
        ALTER TABLE "nodes" 
        ADD CONSTRAINT "nodes_parentId_fkey" 
        FOREIGN KEY ("parentId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- nodes -> tag_templates (supertagId)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'nodes_supertagId_fkey'
    ) THEN
        ALTER TABLE "nodes" 
        ADD CONSTRAINT "nodes_supertagId_fkey" 
        FOREIGN KEY ("supertagId") REFERENCES "tag_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- user_tag_library -> users (userId)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_tag_library_userId_fkey'
    ) THEN
        ALTER TABLE "user_tag_library" 
        ADD CONSTRAINT "user_tag_library_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- user_tag_library -> tag_templates (tagTemplateId)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_tag_library_tagTemplateId_fkey'
    ) THEN
        ALTER TABLE "user_tag_library" 
        ADD CONSTRAINT "user_tag_library_tagTemplateId_fkey" 
        FOREIGN KEY ("tagTemplateId") REFERENCES "tag_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- user_settings -> users (userId)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_userId_fkey'
    ) THEN
        ALTER TABLE "user_settings" 
        ADD CONSTRAINT "user_settings_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

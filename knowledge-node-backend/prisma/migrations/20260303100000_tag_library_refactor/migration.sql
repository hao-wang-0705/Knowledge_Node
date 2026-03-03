-- 标签库重构迁移脚本
-- 目标：将 Supertag 用户自定义标签系统改造为系统预置标签架构
-- 策略：清理存量数据 + 表重命名 + 字段扩展 + 新建用户映射表

-- =====================================================
-- 第一步：清理存量数据（防止孤岛效应）
-- =====================================================

-- 1.1 清除节点与标签的关联（将 supertagId 设为 NULL）
UPDATE "nodes" SET "supertagId" = NULL WHERE "supertagId" IS NOT NULL;

-- 1.2 删除所有现有标签数据
DELETE FROM "supertags";

-- 1.3 删除所有分类数据（标签分类）
DELETE FROM "categories";

-- =====================================================
-- 第二步：重命名表并修改结构
-- =====================================================

-- 2.1 重命名 supertags 表为 tag_templates
ALTER TABLE "supertags" RENAME TO "tag_templates";

-- 2.2 移除旧的 userId 外键约束（系统标签不再属于特定用户）
ALTER TABLE "tag_templates" DROP CONSTRAINT IF EXISTS "supertags_userId_fkey";

-- 2.3 移除 userId 列（系统标签无需 userId）
ALTER TABLE "tag_templates" DROP COLUMN IF EXISTS "userId";

-- 2.4 移除旧的唯一约束 (userId, name)
ALTER TABLE "tag_templates" DROP CONSTRAINT IF EXISTS "supertags_userId_name_key";

-- 2.5 移除 isSystem 列（新架构下所有标签都是系统预置）
ALTER TABLE "tag_templates" DROP COLUMN IF EXISTS "isSystem";

-- =====================================================
-- 第三步：添加新字段
-- =====================================================

-- 3.1 添加 isGlobalDefault 字段（系统预置标识）
ALTER TABLE "tag_templates" ADD COLUMN "isGlobalDefault" BOOLEAN NOT NULL DEFAULT true;

-- 3.2 添加 creatorId 字段（预留 UGC 创建者）
ALTER TABLE "tag_templates" ADD COLUMN "creatorId" TEXT;

-- 3.3 添加 status 字段（标签状态）
ALTER TABLE "tag_templates" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';

-- =====================================================
-- 第四步：重建索引
-- =====================================================

-- 4.1 移除旧索引
DROP INDEX IF EXISTS "supertags_userId_idx";

-- 4.2 创建新的复合索引
CREATE INDEX "tag_templates_isGlobalDefault_status_idx" ON "tag_templates"("isGlobalDefault", "status");
CREATE INDEX "tag_templates_creatorId_idx" ON "tag_templates"("creatorId");

-- 4.3 重命名继承关系索引（如果存在）
DROP INDEX IF EXISTS "supertags_parentId_idx";
CREATE INDEX "tag_templates_parentId_idx" ON "tag_templates"("parentId");

DROP INDEX IF EXISTS "supertags_categoryId_idx";
CREATE INDEX "tag_templates_categoryId_idx" ON "tag_templates"("categoryId");

-- =====================================================
-- 第五步：更新外键约束
-- =====================================================

-- 5.1 更新 Node 表的外键引用（从 supertags 改为 tag_templates）
ALTER TABLE "nodes" DROP CONSTRAINT IF EXISTS "nodes_supertagId_fkey";
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_supertagId_fkey" 
    FOREIGN KEY ("supertagId") REFERENCES "tag_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5.2 更新自引用继承关系外键
ALTER TABLE "tag_templates" DROP CONSTRAINT IF EXISTS "supertags_parentId_fkey";
ALTER TABLE "tag_templates" ADD CONSTRAINT "tag_templates_parentId_fkey" 
    FOREIGN KEY ("parentId") REFERENCES "tag_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5.3 添加 creatorId 外键（可选，关联 User）
ALTER TABLE "tag_templates" ADD CONSTRAINT "tag_templates_creatorId_fkey" 
    FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================
-- 第六步：创建用户标签库映射表（预留 UGC 模版市场）
-- =====================================================

CREATE TABLE "user_tag_library" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tagTemplateId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_tag_library_pkey" PRIMARY KEY ("id")
);

-- 6.1 添加唯一约束
ALTER TABLE "user_tag_library" ADD CONSTRAINT "user_tag_library_userId_tagTemplateId_key" 
    UNIQUE ("userId", "tagTemplateId");

-- 6.2 添加索引
CREATE INDEX "user_tag_library_userId_idx" ON "user_tag_library"("userId");
CREATE INDEX "user_tag_library_tagTemplateId_idx" ON "user_tag_library"("tagTemplateId");

-- 6.3 添加外键约束
ALTER TABLE "user_tag_library" ADD CONSTRAINT "user_tag_library_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_tag_library" ADD CONSTRAINT "user_tag_library_tagTemplateId_fkey" 
    FOREIGN KEY ("tagTemplateId") REFERENCES "tag_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- v3.4: 彻底移除标签继承机制和标签分类机制

-- 1. 移除 TagTemplate 的继承关系外键和索引
ALTER TABLE "tag_templates" DROP CONSTRAINT IF EXISTS "tag_templates_parentId_fkey";
DROP INDEX IF EXISTS "tag_templates_parentId_idx";

-- 2. 移除 TagTemplate 的分类索引
DROP INDEX IF EXISTS "tag_templates_categoryId_idx";

-- 3. 移除 TagTemplate 的 parentId 和 categoryId 列
ALTER TABLE "tag_templates" DROP COLUMN IF EXISTS "parentId";
ALTER TABLE "tag_templates" DROP COLUMN IF EXISTS "categoryId";

-- 4. 删除 categories 表（已在上一次迁移中清空数据）
DROP TABLE IF EXISTS "categories";

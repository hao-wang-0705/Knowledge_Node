-- Compatibility migration: keep legacy timestamp columns while preserving new schema columns
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);

UPDATE "users"
SET
  "created_at" = COALESCE("created_at", "createdAt"),
  "updated_at" = COALESCE("updated_at", "updatedAt");

ALTER TABLE "users" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

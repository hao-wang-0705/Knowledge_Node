-- AlterTable
ALTER TABLE "supertags" ADD COLUMN "parent_id" TEXT,
ADD COLUMN "template_content" JSONB;

-- CreateIndex
CREATE INDEX "supertags_parent_id_idx" ON "supertags"("parent_id");

-- AddForeignKey
ALTER TABLE "supertags" ADD CONSTRAINT "supertags_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "supertags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

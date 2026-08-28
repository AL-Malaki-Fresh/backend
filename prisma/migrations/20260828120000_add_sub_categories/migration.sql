-- Subcategories used to be modeled as a Category self-relation via
-- parent_id (a "subcategory" was just another categories row pointing at
-- itself as parent). That was never actually used for real hierarchy data
-- (seed data and production categories are flat), and it conflated two
-- different concepts. This migration removes that self-relation and
-- introduces a dedicated sub_categories table, plus lets products optionally
-- point at a specific subcategory in addition to their top-level category.

-- DropForeignKey
ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_parent_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "categories_parent_id_idx";

-- AlterTable
ALTER TABLE "categories" DROP COLUMN IF EXISTS "parent_id";

-- CreateTable
CREATE TABLE "sub_categories" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "description_ar" TEXT,
    "icon" VARCHAR(50),
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "sub_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sub_categories_slug_key" ON "sub_categories"("slug");

-- CreateIndex
CREATE INDEX "sub_categories_category_id_idx" ON "sub_categories"("category_id");

-- AddForeignKey
ALTER TABLE "sub_categories" ADD CONSTRAINT "sub_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "products" ADD COLUMN "sub_category_id" UUID;

-- CreateIndex
CREATE INDEX "products_sub_category_id_idx" ON "products"("sub_category_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_sub_category_id_fkey" FOREIGN KEY ("sub_category_id") REFERENCES "sub_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

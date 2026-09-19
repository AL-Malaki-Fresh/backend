# Catalog import — 2026-09-15 migration

`import-data-migrated.json` in this folder replaces the old placeholder
catalog (the old `import-data.json`'s "products" were actually group-level
labels from the PDF report, not real products). It was built from
`ONLINE DATA 090926.xlsx` (POS export): 6,562 unique products, each
classified by name into one of the existing 67 subCategories, plus a new
`Uncategorized` category/subCategory (isActive=false) for the ~30% that
couldn't be confidently classified.

Full write-up of how it was built: see the Cowork session notes / the
project's `product_data_migration.md` doc.

## Before you run this

1. **Make sure the SubCategory migration is deployed** to whichever database
   `DATABASE_URL` points at:
   ```
   npx prisma migrate deploy
   npx prisma generate
   ```
   (`prisma/migrations/20260828120000_add_sub_categories`). This script calls
   `prisma.subCategory.upsert`, which will throw if that table doesn't exist
   yet.

2. **Review the Uncategorized bucket first if you can** — open
   `import-data-migrated.json`, find `"slug": "uncategorized"`, and skim the
   ~1,944 products in there. They're all `isActive: false` so importing them
   as-is is safe (they won't show up for customers), but the sooner they're
   sorted into real subCategories the better. You can re-run this script any
   time after editing the JSON — everything upserts by `slug`.

3. **Product images don't exist yet.** Every product's `imageUrl` is built
   as `https://res.cloudinary.com/fr4bdzfj/image/upload/v1787916136/{barcode}`
   but nothing has actually been uploaded to Cloudinary at that path — until
   you upload one image per barcode, those URLs will 404 in the app. Say the
   word if you want a script to batch-upload a folder of images named by
   barcode.

## Running it

From `ALMALAKI-Backend/`:

```bash
# Preview what would happen, no writes:
node scripts/catalog-import/import-catalog.js --dry-run

# Actually import (upserts everything by slug — safe to re-run):
node scripts/catalog-import/import-catalog.js
```

Make sure your shell's `DATABASE_URL` points at the database you actually
want to write to (production vs local) before running it for real.

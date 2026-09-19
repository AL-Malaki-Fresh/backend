/**
 * Imports categories / subCategories / products from a migrated catalog JSON
 * (see import-data-migrated.json in this same folder) into the database via
 * Prisma. Upserts everything by `slug`, so it's safe to re-run.
 *
 * Requires the SubCategory migration to already be applied to the target
 * database (prisma/migrations/20260828120000_add_sub_categories) — run
 * `npx prisma migrate deploy` first if you haven't.
 *
 * Usage (run from ALMALAKI-Backend/):
 *   node scripts/catalog-import/import-catalog.js                 # imports for real
 *   node scripts/catalog-import/import-catalog.js --dry-run        # preview only, no writes
 *   node scripts/catalog-import/import-catalog.js path/to/file.json
 *
 * Make sure DATABASE_URL in your environment points at the database you
 * actually want to write to before running without --dry-run.
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fileArg = args.find((a) => !a.startsWith('--'));
const jsonPath = path.resolve(
  fileArg || path.join(__dirname, 'import-data-migrated.json')
);

if (!fs.existsSync(jsonPath)) {
  console.error(`Catalog JSON not found at: ${jsonPath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

// This project's Prisma version (7.x) requires an explicit driver adapter —
// `new PrismaClient()` with no options throws "A driver adapter is required
// to connect to your database." Same pg.Pool + PrismaPg pattern as
// prisma/seed.js: Render's *external* Postgres endpoint (the one reachable
// from a local machine, as opposed to Render's internal network) requires
// SSL, or the connection gets closed as soon as a real transaction starts.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    /@(localhost|127\.0\.0\.1|postgres):/.test(process.env.DATABASE_URL || '')
      ? false
      : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function toDecimalOrNull(v) {
  return v === null || v === undefined ? null : v;
}

async function main() {
  console.log(`Loading catalog from ${jsonPath}`);
  console.log(dryRun ? 'DRY RUN — no writes will be made.\n' : 'LIVE RUN — writing to the database.\n');

  let catCount = 0, subCount = 0, prodCount = 0, prodErrors = 0;

  for (const cat of data.categories) {
    catCount++;
    let categoryId;

    if (dryRun) {
      console.log(`[category] ${cat.sourceCode} ${cat.name}`);
    } else {
      const category = await prisma.category.upsert({
        where: { slug: cat.slug },
        update: {
          name: cat.name,
          nameAr: cat.nameAr,
          description: cat.description,
          descriptionAr: cat.descriptionAr,
          icon: cat.icon,
          imageUrl: cat.imageUrl,
          isActive: cat.isActive,
          sortOrder: cat.sortOrder,
        },
        create: {
          name: cat.name,
          nameAr: cat.nameAr,
          slug: cat.slug,
          description: cat.description,
          descriptionAr: cat.descriptionAr,
          icon: cat.icon,
          imageUrl: cat.imageUrl,
          isActive: cat.isActive,
          sortOrder: cat.sortOrder,
        },
      });
      categoryId = category.id;
    }

    for (const sub of cat.subCategories) {
      subCount++;
      let subCategoryId;

      if (dryRun) {
        console.log(`  [subcategory] ${sub.sourceCode} ${sub.name}  (${sub.products.length} products)`);
      } else {
        const subCategory = await prisma.subCategory.upsert({
          where: { slug: sub.slug },
          update: {
            categoryId,
            name: sub.name,
            nameAr: sub.nameAr,
            description: sub.description,
            descriptionAr: sub.descriptionAr,
            icon: sub.icon,
            imageUrl: sub.imageUrl,
            isActive: sub.isActive,
            sortOrder: sub.sortOrder,
          },
          create: {
            categoryId,
            name: sub.name,
            nameAr: sub.nameAr,
            slug: sub.slug,
            description: sub.description,
            descriptionAr: sub.descriptionAr,
            icon: sub.icon,
            imageUrl: sub.imageUrl,
            isActive: sub.isActive,
            sortOrder: sub.sortOrder,
          },
        });
        subCategoryId = subCategory.id;
      }

      for (const p of sub.products) {
        prodCount++;
        if (dryRun) continue;

        try {
          await prisma.product.upsert({
            where: { slug: p.slug },
            update: {
              categoryId,
              subCategoryId,
              name: p.name,
              nameAr: p.nameAr,
              description: p.description,
              descriptionAr: p.descriptionAr,
              unitLabel: p.unitLabel,
              price: p.price,
              comparePrice: toDecimalOrNull(p.comparePrice),
              costPrice: toDecimalOrNull(p.costPrice),
              sku: p.sku,
              barcode: p.barcode,
              imageUrl: p.imageUrl,
              galleryImages: p.galleryImages || [],
              isFresh: p.isFresh,
              inStock: p.inStock,
              stockQuantity: p.stockQuantity,
              brand: p.brand,
              isFeatured: p.isFeatured,
              isActive: p.isActive,
            },
            create: {
              categoryId,
              subCategoryId,
              name: p.name,
              nameAr: p.nameAr,
              description: p.description,
              descriptionAr: p.descriptionAr,
              slug: p.slug,
              unitLabel: p.unitLabel,
              price: p.price,
              comparePrice: toDecimalOrNull(p.comparePrice),
              costPrice: toDecimalOrNull(p.costPrice),
              sku: p.sku,
              barcode: p.barcode,
              imageUrl: p.imageUrl,
              galleryImages: p.galleryImages || [],
              isFresh: p.isFresh,
              inStock: p.inStock,
              stockQuantity: p.stockQuantity,
              brand: p.brand,
              isFeatured: p.isFeatured,
              isActive: p.isActive,
            },
          });
        } catch (err) {
          prodErrors++;
          console.error(`  ! product failed: ${p.sku} ${p.name} -> ${err.message}`);
        }
      }
    }
  }

  console.log('\nDone.');
  console.log(`Categories: ${catCount}`);
  console.log(`SubCategories: ${subCount}`);
  console.log(`Products: ${prodCount}${dryRun ? ' (not written, dry run)' : ` (${prodCount - prodErrors} written, ${prodErrors} failed)`}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

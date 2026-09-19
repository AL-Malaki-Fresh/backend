// Shared helpers for promotions and coupons, which both target a mix of
// categories, subcategories and products via three UUID arrays.

const prisma = require("../config/prisma");

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

// Accepts undefined (=> undefined, "leave unchanged"), null / "" (=> []),
// or an array of UUID strings. De-duplicates. Anything else is a 400.
const normalizeIdList = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return [];

  if (!Array.isArray(value)) {
    throw createError(
      `${fieldName} must be an array of ids`,
      400,
      "INVALID_TARGET_LIST"
    );
  }

  const ids = [...new Set(value.map((id) => String(id).trim()))];

  for (const id of ids) {
    if (!UUID_REGEX.test(id)) {
      throw createError(
        `${fieldName} contains an invalid id`,
        400,
        "INVALID_TARGET_LIST"
      );
    }
  }

  return ids;
};

// Verifies every id actually exists so a typo can't silently create a
// promotion that never matches anything.
const assertTargetsExist = async ({
  categoryIds = [],
  subCategoryIds = [],
  productIds = [],
}) => {
  const [categories, subCategories, products] = await Promise.all([
    categoryIds.length
      ? prisma.category.count({ where: { id: { in: categoryIds } } })
      : 0,
    subCategoryIds.length
      ? prisma.subCategory.count({ where: { id: { in: subCategoryIds } } })
      : 0,
    productIds.length
      ? prisma.product.count({ where: { id: { in: productIds } } })
      : 0,
  ]);

  if (categories !== categoryIds.length) {
    throw createError(
      "One or more selected categories do not exist",
      400,
      "CATEGORY_NOT_FOUND"
    );
  }
  if (subCategories !== subCategoryIds.length) {
    throw createError(
      "One or more selected subcategories do not exist",
      400,
      "SUBCATEGORY_NOT_FOUND"
    );
  }
  if (products !== productIds.length) {
    throw createError(
      "One or more selected products do not exist",
      400,
      "PRODUCT_NOT_FOUND"
    );
  }
};

// Attaches human-readable `targets` ({categories, subCategories, products}
// as {id, name, nameAr}) to a list of promotions/coupons, using one query
// per target type for the whole list.
const attachTargets = async (records) => {
  const collect = (key) => [...new Set(records.flatMap((r) => r[key] || []))];

  const categoryIds = collect("categoryIds");
  const subCategoryIds = collect("subCategoryIds");
  const productIds = collect("productIds");

  const select = { id: true, name: true, nameAr: true };

  const [categories, subCategories, products] = await Promise.all([
    categoryIds.length
      ? prisma.category.findMany({ where: { id: { in: categoryIds } }, select })
      : [],
    subCategoryIds.length
      ? prisma.subCategory.findMany({
          where: { id: { in: subCategoryIds } },
          select,
        })
      : [],
    productIds.length
      ? prisma.product.findMany({ where: { id: { in: productIds } }, select })
      : [],
  ]);

  const byId = (rows) => new Map(rows.map((row) => [row.id, row]));
  const categoryMap = byId(categories);
  const subCategoryMap = byId(subCategories);
  const productMap = byId(products);

  const pick = (ids, map) => (ids || []).map((id) => map.get(id)).filter(Boolean);

  return records.map((record) => ({
    ...record,
    targets: {
      categories: pick(record.categoryIds, categoryMap),
      subCategories: pick(record.subCategoryIds, subCategoryMap),
      products: pick(record.productIds, productMap),
    },
  }));
};

module.exports = {
  createError,
  normalizeIdList,
  assertTargetsExist,
  attachTargets,
};

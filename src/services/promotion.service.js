const { Prisma } = require("@prisma/client");

const prisma = require("../config/prisma");
const {
  createError,
  normalizeIdList,
  assertTargetsExist,
  attachTargets,
} = require("../utils/promotionTargets");

const MAX_LIMIT = 100;

const promotionSelect = {
  id: true,
  name: true,
  nameAr: true,
  description: true,
  descriptionAr: true,
  discountPercent: true,
  startDate: true,
  endDate: true,
  isActive: true,
  categoryIds: true,
  subCategoryIds: true,
  productIds: true,
  createdAt: true,
  updatedAt: true,
};

const normalizeString = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
};

const parseDate = (value, fieldName) => {
  const date = new Date(value);

  if (value === undefined || value === null || value === "" || Number.isNaN(date.getTime())) {
    throw createError(`${fieldName} is required and must be a valid date`, 400, "INVALID_DATE");
  }

  return date;
};

const parsePercent = (value) => {
  const percent = Number(value);

  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
    throw createError(
      "Discount percent must be greater than 0 and at most 100",
      400,
      "INVALID_DISCOUNT_PERCENT"
    );
  }

  return new Prisma.Decimal(percent).toDecimalPlaces(2);
};

const parseBoolean = (value) => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
};

// scheduled | active | expired | inactive (switched off by an admin)
const getPromotionStatus = (promotion, now = new Date()) => {
  if (!promotion.isActive) return "inactive";
  if (promotion.endDate < now) return "expired";
  if (promotion.startDate > now) return "scheduled";
  return "active";
};

const withStatus = (promotion) => ({
  ...promotion,
  status: getPromotionStatus(promotion),
});

const decorate = async (promotions) =>
  (await attachTargets(promotions)).map(withStatus);

const statusWhere = (status, now = new Date()) => {
  switch (status) {
    case "active":
      return { isActive: true, startDate: { lte: now }, endDate: { gte: now } };
    case "scheduled":
      return { isActive: true, startDate: { gt: now } };
    case "expired":
      return { isActive: true, endDate: { lt: now } };
    case "inactive":
      return { isActive: false };
    default:
      return {};
  }
};

const findPromotionOrFail = async (id) => {
  const promotion = await prisma.promotion.findUnique({
    where: { id },
    select: promotionSelect,
  });

  if (!promotion) {
    throw createError("Promotion not found", 404, "PROMOTION_NOT_FOUND");
  }

  return promotion;
};

const assertHasTargets = ({ categoryIds, subCategoryIds, productIds }) => {
  if (!categoryIds.length && !subCategoryIds.length && !productIds.length) {
    throw createError(
      "Select at least one category, subcategory or product for this promotion",
      400,
      "PROMOTION_TARGET_REQUIRED"
    );
  }
};

const createPromotion = async (body = {}) => {
  const name = normalizeString(body.name);

  if (!name) {
    throw createError("Promotion name is required", 400, "PROMOTION_NAME_REQUIRED");
  }

  const startDate = parseDate(body.startDate, "Start date");
  const endDate = parseDate(body.endDate, "End date");

  if (endDate <= startDate) {
    throw createError("End date must be after start date", 400, "INVALID_DATE_RANGE");
  }

  const categoryIds = normalizeIdList(body.categoryIds, "categoryIds") ?? [];
  const subCategoryIds = normalizeIdList(body.subCategoryIds, "subCategoryIds") ?? [];
  const productIds = normalizeIdList(body.productIds, "productIds") ?? [];

  assertHasTargets({ categoryIds, subCategoryIds, productIds });
  await assertTargetsExist({ categoryIds, subCategoryIds, productIds });

  const promotion = await prisma.promotion.create({
    data: {
      name,
      nameAr: normalizeString(body.nameAr) ?? null,
      description: normalizeString(body.description) ?? null,
      descriptionAr: normalizeString(body.descriptionAr) ?? null,
      discountPercent: parsePercent(body.discountPercent),
      startDate,
      endDate,
      isActive: parseBoolean(body.isActive) ?? true,
      categoryIds,
      subCategoryIds,
      productIds,
    },
    select: promotionSelect,
  });

  return (await decorate([promotion]))[0];
};

const updatePromotion = async (id, body = {}) => {
  const existing = await findPromotionOrFail(id);

  const data = {};

  if (body.name !== undefined) {
    const name = normalizeString(body.name);
    if (!name) {
      throw createError("Promotion name is required", 400, "PROMOTION_NAME_REQUIRED");
    }
    data.name = name;
  }

  if (body.nameAr !== undefined) data.nameAr = normalizeString(body.nameAr);
  if (body.description !== undefined) data.description = normalizeString(body.description);
  if (body.descriptionAr !== undefined) data.descriptionAr = normalizeString(body.descriptionAr);
  if (body.discountPercent !== undefined) data.discountPercent = parsePercent(body.discountPercent);

  if (body.startDate !== undefined) data.startDate = parseDate(body.startDate, "Start date");
  if (body.endDate !== undefined) data.endDate = parseDate(body.endDate, "End date");

  const finalStart = data.startDate ?? existing.startDate;
  const finalEnd = data.endDate ?? existing.endDate;

  if (finalEnd <= finalStart) {
    throw createError("End date must be after start date", 400, "INVALID_DATE_RANGE");
  }

  if (body.isActive !== undefined) {
    const isActive = parseBoolean(body.isActive);
    if (isActive === undefined) {
      throw createError("isActive must be true or false", 400, "INVALID_STATUS");
    }
    data.isActive = isActive;
  }

  const categoryIds = normalizeIdList(body.categoryIds, "categoryIds");
  const subCategoryIds = normalizeIdList(body.subCategoryIds, "subCategoryIds");
  const productIds = normalizeIdList(body.productIds, "productIds");

  if (categoryIds !== undefined) data.categoryIds = categoryIds;
  if (subCategoryIds !== undefined) data.subCategoryIds = subCategoryIds;
  if (productIds !== undefined) data.productIds = productIds;

  const finalTargets = {
    categoryIds: data.categoryIds ?? existing.categoryIds,
    subCategoryIds: data.subCategoryIds ?? existing.subCategoryIds,
    productIds: data.productIds ?? existing.productIds,
  };

  assertHasTargets(finalTargets);
  await assertTargetsExist({
    categoryIds: data.categoryIds ?? [],
    subCategoryIds: data.subCategoryIds ?? [],
    productIds: data.productIds ?? [],
  });

  const promotion = await prisma.promotion.update({
    where: { id },
    data,
    select: promotionSelect,
  });

  return (await decorate([promotion]))[0];
};

const updatePromotionStatus = async (id, isActive) => {
  const parsed = parseBoolean(isActive);

  if (parsed === undefined) {
    throw createError("isActive must be true or false", 400, "INVALID_STATUS");
  }

  await findPromotionOrFail(id);

  const promotion = await prisma.promotion.update({
    where: { id },
    data: { isActive: parsed },
    select: promotionSelect,
  });

  return (await decorate([promotion]))[0];
};

const deletePromotion = async (id) => {
  await findPromotionOrFail(id);
  await prisma.promotion.delete({ where: { id } });

  return { message: "Promotion deleted successfully" };
};

const getPromotionById = async (id) =>
  (await decorate([await findPromotionOrFail(id)]))[0];

const getAllPromotions = async ({ page = 1, limit = 10, search, status } = {}) => {
  const pageNumber = Math.max(1, Math.floor(Number(page)) || 1);
  const limitNumber = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(limit)) || 10));

  const searchText = typeof search === "string" ? search.trim() : "";

  const where = {
    ...statusWhere(status),
    ...(searchText
      ? {
          OR: [
            { name: { contains: searchText, mode: "insensitive" } },
            { nameAr: { contains: searchText, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const now = new Date();

  const [promotions, total, active, scheduled, expired, inactive] =
    await Promise.all([
      prisma.promotion.findMany({
        where,
        skip: (pageNumber - 1) * limitNumber,
        take: limitNumber,
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
        select: promotionSelect,
      }),
      prisma.promotion.count({ where }),
      prisma.promotion.count({ where: statusWhere("active", now) }),
      prisma.promotion.count({ where: statusWhere("scheduled", now) }),
      prisma.promotion.count({ where: statusWhere("expired", now) }),
      prisma.promotion.count({ where: statusWhere("inactive", now) }),
    ]);

  return {
    data: await decorate(promotions),
    statistics: { active, scheduled, expired, inactive },
    pagination: {
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

module.exports = {
  createPromotion,
  updatePromotion,
  updatePromotionStatus,
  deletePromotion,
  getPromotionById,
  getAllPromotions,
};

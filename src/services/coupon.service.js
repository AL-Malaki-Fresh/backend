const { Prisma } = require("@prisma/client");

const prisma = require("../config/prisma");
const {
  createError,
  normalizeIdList,
  assertTargetsExist,
  attachTargets,
} = require("../utils/promotionTargets");
const { normalizeCouponCode } = require("./pricing.service");

const MAX_LIMIT = 100;
const CODE_REGEX = /^[A-Z0-9_-]{3,50}$/;

const couponAdminSelect = {
  id: true,
  code: true,
  description: true,
  descriptionAr: true,
  discountType: true,
  discountValue: true,
  maxDiscountAmount: true,
  minOrderAmount: true,
  maxOrderAmount: true,
  startDate: true,
  endDate: true,
  usageLimit: true,
  usageLimitPerUser: true,
  usedCount: true,
  excludePromotedItems: true,
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

const parseBoolean = (value) => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
};

const isBlank = (value) => value === undefined || value === null || value === "";

// Optional money field: blank => null (no limit), otherwise a number >= 0.
const parseOptionalMoney = (value, fieldName) => {
  if (isBlank(value)) return null;

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    throw createError(`${fieldName} must be a number of 0 or more`, 400, "INVALID_AMOUNT");
  }

  return new Prisma.Decimal(amount).toDecimalPlaces(2);
};

const parseOptionalPositiveInt = (value, fieldName) => {
  if (isBlank(value)) return null;

  const number = Number(value);

  if (!Number.isInteger(number) || number < 1) {
    throw createError(`${fieldName} must be a whole number of 1 or more`, 400, "INVALID_LIMIT");
  }

  return number;
};

const parseOptionalDate = (value, fieldName) => {
  if (isBlank(value)) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createError(`${fieldName} must be a valid date`, 400, "INVALID_DATE");
  }

  return date;
};

const parseDiscountType = (value) => {
  const type = String(value ?? "").trim().toUpperCase();

  if (type !== "PERCENTAGE" && type !== "FIXED") {
    throw createError(
      "Discount type must be PERCENTAGE or FIXED",
      400,
      "INVALID_DISCOUNT_TYPE"
    );
  }

  return type;
};

const parseDiscountValue = (type, value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw createError("Discount value must be greater than 0", 400, "INVALID_DISCOUNT_VALUE");
  }

  if (type === "PERCENTAGE" && amount > 100) {
    throw createError("A percentage discount cannot exceed 100", 400, "INVALID_DISCOUNT_VALUE");
  }

  return new Prisma.Decimal(amount).toDecimalPlaces(2);
};

const parseCode = (value) => {
  const code = normalizeCouponCode(value);

  if (!CODE_REGEX.test(code)) {
    throw createError(
      "Coupon code must be 3-50 characters: letters, numbers, dash or underscore",
      400,
      "INVALID_COUPON_CODE"
    );
  }

  return code;
};

// scheduled | active | expired | exhausted | inactive
const getCouponStatus = (coupon, now = new Date()) => {
  if (!coupon.isActive) return "inactive";
  if (coupon.endDate && coupon.endDate < now) return "expired";
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return "exhausted";
  }
  if (coupon.startDate && coupon.startDate > now) return "scheduled";
  return "active";
};

const decorate = async (coupons) =>
  (await attachTargets(coupons)).map((coupon) => ({
    ...coupon,
    status: getCouponStatus(coupon),
  }));

const findCouponOrFail = async (id) => {
  const coupon = await prisma.coupon.findUnique({
    where: { id },
    select: couponAdminSelect,
  });

  if (!coupon) {
    throw createError("Coupon not found", 404, "COUPON_NOT_FOUND");
  }

  return coupon;
};

const assertCouponConsistency = ({
  minOrderAmount,
  maxOrderAmount,
  startDate,
  endDate,
  discountType,
  discountValue,
  maxDiscountAmount,
}) => {
  if (
    minOrderAmount != null &&
    maxOrderAmount != null &&
    new Prisma.Decimal(maxOrderAmount).lt(new Prisma.Decimal(minOrderAmount))
  ) {
    throw createError(
      "Maximum order amount cannot be lower than the minimum order amount",
      400,
      "INVALID_ORDER_AMOUNT_RANGE"
    );
  }

  if (startDate && endDate && endDate <= startDate) {
    throw createError("End date must be after start date", 400, "INVALID_DATE_RANGE");
  }

  if (
    discountType === "FIXED" &&
    minOrderAmount != null &&
    new Prisma.Decimal(discountValue).gt(new Prisma.Decimal(minOrderAmount)) &&
    new Prisma.Decimal(minOrderAmount).gt(0)
  ) {
    throw createError(
      "A fixed discount cannot be larger than the minimum order amount",
      400,
      "INVALID_DISCOUNT_VALUE"
    );
  }

  if (discountType === "FIXED" && maxDiscountAmount != null) {
    throw createError(
      "A maximum discount cap only applies to percentage coupons",
      400,
      "INVALID_MAX_DISCOUNT"
    );
  }
};

const createCoupon = async (body = {}) => {
  const code = parseCode(body.code);
  const discountType = parseDiscountType(body.discountType);
  const discountValue = parseDiscountValue(discountType, body.discountValue);

  const maxDiscountAmount = parseOptionalMoney(body.maxDiscountAmount, "Maximum discount");
  const minOrderAmount = parseOptionalMoney(body.minOrderAmount, "Minimum order amount");
  const maxOrderAmount = parseOptionalMoney(body.maxOrderAmount, "Maximum order amount");
  const startDate = parseOptionalDate(body.startDate, "Start date");
  const endDate = parseOptionalDate(body.endDate, "End date");

  assertCouponConsistency({
    minOrderAmount,
    maxOrderAmount,
    startDate,
    endDate,
    discountType,
    discountValue,
    maxDiscountAmount,
  });

  const categoryIds = normalizeIdList(body.categoryIds, "categoryIds") ?? [];
  const subCategoryIds = normalizeIdList(body.subCategoryIds, "subCategoryIds") ?? [];
  const productIds = normalizeIdList(body.productIds, "productIds") ?? [];

  await assertTargetsExist({ categoryIds, subCategoryIds, productIds });

  const duplicate = await prisma.coupon.findUnique({ where: { code }, select: { id: true } });
  if (duplicate) {
    throw createError("A coupon with this code already exists", 409, "COUPON_CODE_EXISTS");
  }

  const coupon = await prisma.coupon.create({
    data: {
      code,
      description: normalizeString(body.description) ?? null,
      descriptionAr: normalizeString(body.descriptionAr) ?? null,
      discountType,
      discountValue,
      maxDiscountAmount,
      minOrderAmount,
      maxOrderAmount,
      startDate,
      endDate,
      usageLimit: parseOptionalPositiveInt(body.usageLimit, "Usage limit"),
      usageLimitPerUser: parseOptionalPositiveInt(body.usageLimitPerUser, "Usage limit per user"),
      excludePromotedItems: parseBoolean(body.excludePromotedItems) ?? false,
      isActive: parseBoolean(body.isActive) ?? true,
      categoryIds,
      subCategoryIds,
      productIds,
    },
    select: couponAdminSelect,
  });

  return (await decorate([coupon]))[0];
};

const updateCoupon = async (id, body = {}) => {
  const existing = await findCouponOrFail(id);
  const data = {};

  if (body.code !== undefined) {
    const code = parseCode(body.code);
    if (code !== existing.code) {
      const duplicate = await prisma.coupon.findUnique({ where: { code }, select: { id: true } });
      if (duplicate) {
        throw createError("A coupon with this code already exists", 409, "COUPON_CODE_EXISTS");
      }
      data.code = code;
    }
  }

  if (body.description !== undefined) data.description = normalizeString(body.description);
  if (body.descriptionAr !== undefined) data.descriptionAr = normalizeString(body.descriptionAr);

  if (body.discountType !== undefined) data.discountType = parseDiscountType(body.discountType);

  const finalType = data.discountType ?? existing.discountType;

  if (body.discountValue !== undefined || body.discountType !== undefined) {
    data.discountValue = parseDiscountValue(
      finalType,
      body.discountValue !== undefined ? body.discountValue : existing.discountValue
    );
  }

  if (body.maxDiscountAmount !== undefined) {
    data.maxDiscountAmount = parseOptionalMoney(body.maxDiscountAmount, "Maximum discount");
  } else if (finalType === "FIXED") {
    data.maxDiscountAmount = null;
  }

  if (body.minOrderAmount !== undefined) {
    data.minOrderAmount = parseOptionalMoney(body.minOrderAmount, "Minimum order amount");
  }
  if (body.maxOrderAmount !== undefined) {
    data.maxOrderAmount = parseOptionalMoney(body.maxOrderAmount, "Maximum order amount");
  }
  if (body.startDate !== undefined) data.startDate = parseOptionalDate(body.startDate, "Start date");
  if (body.endDate !== undefined) data.endDate = parseOptionalDate(body.endDate, "End date");

  if (body.usageLimit !== undefined) {
    data.usageLimit = parseOptionalPositiveInt(body.usageLimit, "Usage limit");
  }
  if (body.usageLimitPerUser !== undefined) {
    data.usageLimitPerUser = parseOptionalPositiveInt(body.usageLimitPerUser, "Usage limit per user");
  }

  if (body.excludePromotedItems !== undefined) {
    const value = parseBoolean(body.excludePromotedItems);
    if (value === undefined) {
      throw createError("excludePromotedItems must be true or false", 400, "INVALID_FLAG");
    }
    data.excludePromotedItems = value;
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

  await assertTargetsExist({
    categoryIds: data.categoryIds ?? [],
    subCategoryIds: data.subCategoryIds ?? [],
    productIds: data.productIds ?? [],
  });

  assertCouponConsistency({
    minOrderAmount: "minOrderAmount" in data ? data.minOrderAmount : existing.minOrderAmount,
    maxOrderAmount: "maxOrderAmount" in data ? data.maxOrderAmount : existing.maxOrderAmount,
    startDate: "startDate" in data ? data.startDate : existing.startDate,
    endDate: "endDate" in data ? data.endDate : existing.endDate,
    discountType: finalType,
    discountValue: data.discountValue ?? existing.discountValue,
    maxDiscountAmount:
      "maxDiscountAmount" in data ? data.maxDiscountAmount : existing.maxDiscountAmount,
  });

  const coupon = await prisma.coupon.update({
    where: { id },
    data,
    select: couponAdminSelect,
  });

  return (await decorate([coupon]))[0];
};

const updateCouponStatus = async (id, isActive) => {
  const parsed = parseBoolean(isActive);

  if (parsed === undefined) {
    throw createError("isActive must be true or false", 400, "INVALID_STATUS");
  }

  await findCouponOrFail(id);

  const coupon = await prisma.coupon.update({
    where: { id },
    data: { isActive: parsed },
    select: couponAdminSelect,
  });

  return (await decorate([coupon]))[0];
};

// A coupon that has been used stays in the database (its usages and the
// orders that reference it are history). Admins deactivate it instead.
const deleteCoupon = async (id) => {
  const coupon = await findCouponOrFail(id);

  if (coupon.usedCount > 0) {
    throw createError(
      "This coupon has already been used. Deactivate it instead of deleting it.",
      409,
      "COUPON_ALREADY_USED"
    );
  }

  await prisma.coupon.delete({ where: { id } });

  return { message: "Coupon deleted successfully" };
};

const getCouponById = async (id) => (await decorate([await findCouponOrFail(id)]))[0];

const statusWhere = (status, now = new Date()) => {
  switch (status) {
    case "active":
      return {
        isActive: true,
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      };
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

const getAllCoupons = async ({ page = 1, limit = 10, search, status } = {}) => {
  const pageNumber = Math.max(1, Math.floor(Number(page)) || 1);
  const limitNumber = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(limit)) || 10));

  const searchText = typeof search === "string" ? search.trim() : "";

  const where = {
    ...statusWhere(status),
    ...(searchText
      ? {
          OR: [
            { code: { contains: searchText, mode: "insensitive" } },
            { description: { contains: searchText, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const now = new Date();

  const [coupons, total, active, scheduled, expired, inactive] = await Promise.all([
    prisma.coupon.findMany({
      where,
      skip: (pageNumber - 1) * limitNumber,
      take: limitNumber,
      orderBy: { createdAt: "desc" },
      select: couponAdminSelect,
    }),
    prisma.coupon.count({ where }),
    prisma.coupon.count({ where: statusWhere("active", now) }),
    prisma.coupon.count({ where: statusWhere("scheduled", now) }),
    prisma.coupon.count({ where: statusWhere("expired", now) }),
    prisma.coupon.count({ where: statusWhere("inactive", now) }),
  ]);

  return {
    data: await decorate(coupons),
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
  createCoupon,
  updateCoupon,
  updateCouponStatus,
  deleteCoupon,
  getCouponById,
  getAllCoupons,
};

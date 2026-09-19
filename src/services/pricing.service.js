// Pricing engine: product promotions + coupon evaluation.
//
// Kept free of HTTP concerns so the same functions serve the product
// listing (promo prices), the cart (running totals), the coupon "apply"
// preview and the real checkout — all four must agree to the cent, so they
// all go through here.

const { Prisma } = require("@prisma/client");

const prisma = require("../config/prisma");
const { createError } = require("../utils/promotionTargets");

const ZERO = new Prisma.Decimal(0);
const HUNDRED = new Prisma.Decimal(100);

const money = (value) =>
  new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

const formatMoney = (value) => money(value).toFixed(2);

// ─── Promotions ─────────────────────────────────────────────────────────────

// Promotions that are switched on and whose window contains `now`.
const getActivePromotions = async (client = prisma, now = new Date()) =>
  client.promotion.findMany({
    where: {
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    select: {
      id: true,
      name: true,
      nameAr: true,
      discountPercent: true,
      startDate: true,
      endDate: true,
      categoryIds: true,
      subCategoryIds: true,
      productIds: true,
    },
  });

// True when the record's target lists cover the product. Used for both
// promotions and coupons. `matchAllWhenEmpty` is for coupons: a coupon with
// no targets applies to everything, a promotion with no targets applies to
// nothing.
const targetsCoverProduct = (
  record,
  product,
  { matchAllWhenEmpty = false } = {}
) => {
  const categoryIds = record.categoryIds || [];
  const subCategoryIds = record.subCategoryIds || [];
  const productIds = record.productIds || [];

  if (!categoryIds.length && !subCategoryIds.length && !productIds.length) {
    return matchAllWhenEmpty;
  }

  return (
    productIds.includes(product.id) ||
    (product.subCategoryId && subCategoryIds.includes(product.subCategoryId)) ||
    (product.categoryId && categoryIds.includes(product.categoryId))
  );
};

// Highest-percentage matching promotion wins (no stacking).
const findBestPromotion = (promotions, product) => {
  let best = null;

  for (const promotion of promotions) {
    if (!targetsCoverProduct(promotion, product)) continue;

    if (
      !best ||
      new Prisma.Decimal(promotion.discountPercent).gt(best.discountPercent)
    ) {
      best = promotion;
    }
  }

  return best;
};

const applyPercent = (price, percent) =>
  money(
    new Prisma.Decimal(price).mul(HUNDRED.minus(new Prisma.Decimal(percent))).div(HUNDRED)
  );

// Returns { originalPrice, price, promotion|null } for one product.
const priceProduct = (product, promotions) => {
  const originalPrice = money(product.price);
  const promotion = findBestPromotion(promotions, product);

  if (!promotion) {
    return { originalPrice, price: originalPrice, promotion: null };
  }

  return {
    originalPrice,
    price: applyPercent(originalPrice, promotion.discountPercent),
    promotion,
  };
};

const publicPromotion = (promotion) =>
  promotion
    ? {
        id: promotion.id,
        name: promotion.name,
        nameAr: promotion.nameAr,
        discountPercent: formatMoney(promotion.discountPercent),
        endDate: promotion.endDate,
      }
    : null;

// Decorates mobile product payloads with `promotion` and `promotionPrice`
// (both null when the product isn't on promotion). Needs categoryId and
// subCategoryId on each product — the mobile product select already has them.
const attachPromotionsToProducts = async (products) => {
  if (!products.length) return products;

  const promotions = await getActivePromotions();

  return products.map((product) => {
    const { price, promotion } = priceProduct(product, promotions);

    return {
      ...product,
      promotion: publicPromotion(promotion),
      promotionPrice: promotion ? price.toFixed(2) : null,
    };
  });
};

// ─── Cart pricing ───────────────────────────────────────────────────────────

// lines: [{ product: { id, price, categoryId, subCategoryId }, quantity }]
// Returns priced lines plus the totals every caller needs.
const priceCartLines = (lines, promotions) => {
  const priced = lines.map((line) => {
    const { originalPrice, price, promotion } = priceProduct(
      line.product,
      promotions
    );

    return {
      ...line,
      originalUnitPrice: originalPrice,
      unitPrice: price,
      promotion,
      lineTotal: price.mul(line.quantity),
    };
  });

  const subtotal = priced.reduce((sum, l) => sum.plus(l.lineTotal), ZERO);
  const originalSubtotal = priced.reduce(
    (sum, l) => sum.plus(l.originalUnitPrice.mul(l.quantity)),
    ZERO
  );

  return {
    lines: priced,
    subtotal: money(subtotal),
    originalSubtotal: money(originalSubtotal),
    promotionDiscount: money(originalSubtotal.minus(subtotal)),
  };
};

// ─── Coupons ────────────────────────────────────────────────────────────────

const normalizeCouponCode = (code) =>
  String(code ?? "")
    .trim()
    .toUpperCase();

const couponSelect = {
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
};

const findCouponByCode = async (client, code) => {
  const normalized = normalizeCouponCode(code);

  if (!normalized) {
    throw createError("Coupon code is required", 400, "COUPON_CODE_REQUIRED");
  }

  const coupon = await client.coupon.findUnique({
    where: { code: normalized },
    select: couponSelect,
  });

  if (!coupon) {
    throw createError("Invalid coupon code", 404, "COUPON_NOT_FOUND");
  }

  return coupon;
};

// Validates `coupon` against a priced cart and returns the discount.
// `pricedCart` is the output of priceCartLines. Throws a 400 with a specific
// `code` for every way a coupon can be ineligible so the app can show a
// useful message.
const evaluateCoupon = async (
  client,
  coupon,
  { userId, pricedCart, now = new Date() }
) => {
  if (!coupon.isActive) {
    throw createError("This coupon is not active", 400, "COUPON_INACTIVE");
  }

  if (coupon.startDate && coupon.startDate > now) {
    throw createError(
      "This coupon is not valid yet",
      400,
      "COUPON_NOT_STARTED"
    );
  }

  if (coupon.endDate && coupon.endDate < now) {
    throw createError("This coupon has expired", 400, "COUPON_EXPIRED");
  }

  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    throw createError(
      "This coupon has reached its usage limit",
      400,
      "COUPON_USAGE_LIMIT_REACHED"
    );
  }

  if (coupon.usageLimitPerUser != null && userId) {
    const userUses = await client.couponUsage.count({
      where: { couponId: coupon.id, userId },
    });

    if (userUses >= coupon.usageLimitPerUser) {
      throw createError(
        "You have already used this coupon the maximum number of times",
        400,
        "COUPON_USER_LIMIT_REACHED"
      );
    }
  }

  const cartSubtotal = pricedCart.subtotal;

  if (
    coupon.minOrderAmount != null &&
    cartSubtotal.lt(new Prisma.Decimal(coupon.minOrderAmount))
  ) {
    throw createError(
      `Minimum order amount for this coupon is ${formatMoney(
        coupon.minOrderAmount
      )}`,
      400,
      "COUPON_MIN_ORDER_NOT_MET"
    );
  }

  if (
    coupon.maxOrderAmount != null &&
    cartSubtotal.gt(new Prisma.Decimal(coupon.maxOrderAmount))
  ) {
    throw createError(
      `This coupon is only valid for orders up to ${formatMoney(
        coupon.maxOrderAmount
      )}`,
      400,
      "COUPON_MAX_ORDER_EXCEEDED"
    );
  }

  // Which cart lines does the coupon discount?
  const eligibleLines = pricedCart.lines.filter((line) => {
    if (coupon.excludePromotedItems && line.promotion) return false;

    return targetsCoverProduct(coupon, line.product, {
      matchAllWhenEmpty: true,
    });
  });

  const eligibleSubtotal = eligibleLines.reduce(
    (sum, line) => sum.plus(line.lineTotal),
    ZERO
  );

  if (eligibleSubtotal.lte(0)) {
    throw createError(
      "This coupon does not apply to any item in your cart",
      400,
      "COUPON_NOT_APPLICABLE"
    );
  }

  let discount;

  if (coupon.discountType === "PERCENTAGE") {
    discount = eligibleSubtotal
      .mul(new Prisma.Decimal(coupon.discountValue))
      .div(HUNDRED);

    if (coupon.maxDiscountAmount != null) {
      const cap = new Prisma.Decimal(coupon.maxDiscountAmount);
      if (discount.gt(cap)) discount = cap;
    }
  } else {
    discount = new Prisma.Decimal(coupon.discountValue);
  }

  // Never discount more than the eligible items are worth.
  if (discount.gt(eligibleSubtotal)) discount = eligibleSubtotal;

  return {
    coupon,
    discountAmount: money(discount),
    eligibleSubtotal: money(eligibleSubtotal),
  };
};

// Called inside the checkout transaction, after the order row exists.
// The usage-limit check is a conditional UPDATE so two customers can't both
// take the last remaining use.
const redeemCoupon = async (tx, { coupon, userId, orderId, discountAmount }) => {
  const result = await tx.coupon.updateMany({
    where: {
      id: coupon.id,
      isActive: true,
      ...(coupon.usageLimit != null
        ? { usedCount: { lt: coupon.usageLimit } }
        : {}),
    },
    data: { usedCount: { increment: 1 } },
  });

  if (result.count === 0) {
    throw createError(
      "This coupon has reached its usage limit",
      409,
      "COUPON_USAGE_LIMIT_REACHED"
    );
  }

  await tx.couponUsage.create({
    data: {
      couponId: coupon.id,
      userId,
      orderId,
      discountAmount,
    },
  });
};

// Called when an order is cancelled: gives the coupon use back.
const releaseCouponForOrder = async (tx, orderId) => {
  const usage = await tx.couponUsage.findUnique({
    where: { orderId },
    select: { id: true, couponId: true },
  });

  if (!usage) return;

  await tx.couponUsage.delete({ where: { id: usage.id } });
  await tx.coupon.updateMany({
    where: { id: usage.couponId, usedCount: { gt: 0 } },
    data: { usedCount: { decrement: 1 } },
  });
};

module.exports = {
  money,
  formatMoney,
  getActivePromotions,
  targetsCoverProduct,
  findBestPromotion,
  priceProduct,
  publicPromotion,
  attachPromotionsToProducts,
  priceCartLines,
  normalizeCouponCode,
  findCouponByCode,
  evaluateCoupon,
  redeemCoupon,
  releaseCouponForOrder,
};

// "Apply coupon" on the checkout screen: prices the customer's current cart,
// runs the coupon through the same evaluateCoupon() the real checkout uses,
// and returns the resulting totals WITHOUT redeeming anything. Checkout
// re-validates from scratch, so a previewed coupon is never trusted.

const prisma = require("../config/prisma");
const pricingService = require("./pricing.service");
const deliverySettingService = require("./delivery-setting.service");
const { createError } = require("../utils/promotionTargets");

const previewCouponForCart = async (userId, code) => {
  const cart = await prisma.cart.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              price: true,
              categoryId: true,
              subCategoryId: true,
            },
          },
        },
      },
    },
  });

  const items = (cart?.items || []).filter((item) => item.product);

  if (!items.length) {
    throw createError("Cart is empty", 400, "CART_EMPTY");
  }

  const promotions = await pricingService.getActivePromotions();

  const pricedCart = pricingService.priceCartLines(
    items.map((item) => ({ product: item.product, quantity: item.quantity })),
    promotions
  );

  const coupon = await pricingService.findCouponByCode(prisma, code);

  const { discountAmount, eligibleSubtotal } = await pricingService.evaluateCoupon(
    prisma,
    coupon,
    { userId, pricedCart }
  );

  const deliveryFee = await deliverySettingService.getDeliveryFee(prisma);

  const total = pricedCart.subtotal.minus(discountAmount).plus(deliveryFee);

  return {
    code: coupon.code,
    description: coupon.description,
    descriptionAr: coupon.descriptionAr,
    discountType: coupon.discountType,
    discountValue: pricingService.formatMoney(coupon.discountValue),
    discountAmount: discountAmount.toFixed(2),
    eligibleSubtotal: eligibleSubtotal.toFixed(2),
    originalSubtotal: pricedCart.originalSubtotal.toFixed(2),
    promotionDiscount: pricedCart.promotionDiscount.toFixed(2),
    subtotal: pricedCart.subtotal.toFixed(2),
    deliveryFee: pricingService.formatMoney(deliveryFee),
    total: pricingService.money(total).toFixed(2),
  };
};

module.exports = { previewCouponForCart };

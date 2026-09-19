const couponPreviewService = require("../../services/couponPreview.service");

const validateCoupon = async (req, res, next) => {
  try {
    const preview = await couponPreviewService.previewCouponForCart(
      req.user.id,
      req.body?.code
    );

    res.status(200).json({
      success: true,
      message: "Coupon applied",
      code: "COUPON_VALID",
      data: preview,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { validateCoupon };

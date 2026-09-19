const express = require("express");
const router = express.Router();

const mobileCouponController = require("../../controllers/mobile/coupon.controller");

// POST /api/mobile/coupons/validate  { code } — previews the discount on the
// customer's current cart. Does not redeem the coupon; checkout does that.
router.post("/validate", mobileCouponController.validateCoupon);

module.exports = router;

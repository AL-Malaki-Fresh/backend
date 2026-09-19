const express = require("express");
const router = express.Router();

const controller = require("../../controllers/admin/coupon.controller");

router.post("/", controller.createCoupon);

router.get("/", controller.getAllCoupons);

router.get("/:id", controller.getCouponById);

router.put("/:id", controller.updateCoupon);

router.patch("/:id/status", controller.updateCouponStatus);

router.delete("/:id", controller.deleteCoupon);

module.exports = router;

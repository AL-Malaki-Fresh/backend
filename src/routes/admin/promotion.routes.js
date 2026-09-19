const express = require("express");
const router = express.Router();

const controller = require("../../controllers/admin/promotion.controller");

router.post("/", controller.createPromotion);

router.get("/", controller.getAllPromotions);

router.get("/:id", controller.getPromotionById);

router.put("/:id", controller.updatePromotion);

router.patch("/:id/status", controller.updatePromotionStatus);

router.delete("/:id", controller.deletePromotion);

module.exports = router;

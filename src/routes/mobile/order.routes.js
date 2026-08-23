const express = require("express");
const router = express.Router();

const mobileOrderController = require("../../controllers/mobile/order.controller");

router.post("/checkout", mobileOrderController.checkout);

router.get("/", mobileOrderController.getMyOrders);

router.get("/:id", mobileOrderController.getMyOrderById);

module.exports = router;
const express = require("express");
const router = express.Router();

const mobileCartController = require("../../controllers/mobile/cart.controller");

router.get("/", mobileCartController.getMyCart);

router.post("/items", mobileCartController.addItemToCart);

router.put("/items/:id", mobileCartController.updateCartItemQuantity);

router.delete("/items/:id", mobileCartController.removeCartItem);

router.delete("/", mobileCartController.clearMyCart);

module.exports = router;
const express = require("express");
const router = express.Router();

const mobileProductController = require("../../controllers/mobile/product.controller");

router.get("/", mobileProductController.getProducts);

router.get("/:id", mobileProductController.getProductById);

module.exports = router;
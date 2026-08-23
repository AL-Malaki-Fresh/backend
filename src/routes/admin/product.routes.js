const express = require("express");
const router = express.Router();

const adminProductController = require("../../controllers/admin/product.controller");

// later we add admin auth middleware here

router.post("/", adminProductController.createProduct);

router.get("/", adminProductController.getAllProducts);

router.get("/:id", adminProductController.getProductById);

router.put("/:id", adminProductController.updateProduct);

router.patch("/:id/status", adminProductController.updateProductStatus);

router.delete("/:id", adminProductController.deleteProduct);

module.exports = router;
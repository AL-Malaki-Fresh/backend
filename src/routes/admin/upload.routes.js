const express = require("express");
const { uploadProductImage } = require("../../middlewares/upload.middleware");
const uploadController = require("../../controllers/admin/upload.controller");

const router = express.Router();

router.post(
  "/product-image",
  uploadProductImage.single("image"),
  uploadController.uploadProductImage
);

module.exports = router;
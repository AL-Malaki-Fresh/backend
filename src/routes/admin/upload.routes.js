const express = require("express");
const {
  uploadProductImage,
  validateUploadedImageContent,
} = require("../../middlewares/upload.middleware");
const uploadController = require("../../controllers/admin/upload.controller");

const router = express.Router();

router.post(
  "/product-image",
  uploadProductImage.single("image"),
  validateUploadedImageContent,
  uploadController.uploadProductImage
);

module.exports = router;
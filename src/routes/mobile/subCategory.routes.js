const express = require("express");
const router = express.Router();

const mobileSubCategoryController = require("../../controllers/mobile/subCategory.controller");

router.get("/", mobileSubCategoryController.getSubCategoriesForMobile);

router.get("/:id", mobileSubCategoryController.getSubCategoryByIdForMobile);

module.exports = router;

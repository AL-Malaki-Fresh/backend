const express = require("express");
const router = express.Router();

const adminSubCategoryController = require("../../controllers/admin/subCategory.controller");

router.post("/", adminSubCategoryController.createSubCategory);

router.get("/", adminSubCategoryController.getAllSubCategories);

router.get("/:id", adminSubCategoryController.getSubCategoryById);

router.put("/:id", adminSubCategoryController.updateSubCategory);

router.patch("/:id/status", adminSubCategoryController.updateSubCategoryStatus);

router.delete("/:id", adminSubCategoryController.deleteSubCategory);

module.exports = router;

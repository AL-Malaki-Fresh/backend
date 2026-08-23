const express = require("express");
const router = express.Router();

const adminCategoryController = require("../../controllers/admin/category.controller");

// later we add admin auth middleware here

router.post("/", adminCategoryController.createCategory);

router.get("/", adminCategoryController.getAllCategories);

router.get("/:id", adminCategoryController.getCategoryById);

router.put("/:id", adminCategoryController.updateCategory);

router.patch("/:id/status", adminCategoryController.updateCategoryStatus);

router.delete("/:id", adminCategoryController.deleteCategory);

module.exports = router;
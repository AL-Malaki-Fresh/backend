const express = require("express");
const router = express.Router();

const mobileCategoryController = require("../../controllers/mobile/category.controller");

router.get("/", mobileCategoryController.getCategoriesForMobile);

router.get("/:id", mobileCategoryController.getCategoryByIdForMobile);

module.exports = router;
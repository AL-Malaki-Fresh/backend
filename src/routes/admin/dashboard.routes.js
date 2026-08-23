const express = require("express");

const dashboardController = require("../../controllers/admin/dashboard.controller");
const {
  authenticate,
  authorizeRoles,
} = require("../../middlewares/auth.middleware");

const router = express.Router();

router.get(
  "/stats",
  authenticate,
  authorizeRoles("ADMIN"),
  dashboardController.getDashboardStats
);

module.exports = router;
const express = require("express");

const router = express.Router();

const adminAuthController = require("../../controllers/admin/auth.controller");
const {
  authenticate,
  authorizeRoles,
} = require("../../middlewares/auth.middleware");
const { authRateLimiter } = require("../../middlewares/rateLimit.middleware");

router.post("/login", authRateLimiter, adminAuthController.login);
router.post("/refresh-token", authRateLimiter, adminAuthController.refreshToken);
router.post("/logout", adminAuthController.logout);

router.get(
  "/me",
  authenticate,
  authorizeRoles("ADMIN"),
  adminAuthController.getCurrentAdmin
);

module.exports = router;
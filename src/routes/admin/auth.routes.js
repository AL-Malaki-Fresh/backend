const express = require("express");

const router = express.Router();

const adminAuthController = require("../../controllers/admin/auth.controller");
const {
  authenticate,
  authorizeRoles,
} = require("../../middlewares/auth.middleware");

router.post("/login", adminAuthController.login);
router.post("/refresh-token", adminAuthController.refreshToken);
router.post("/logout", adminAuthController.logout);

router.get(
  "/me",
  authenticate,
  authorizeRoles("ADMIN"),
  adminAuthController.getCurrentAdmin
);

module.exports = router;
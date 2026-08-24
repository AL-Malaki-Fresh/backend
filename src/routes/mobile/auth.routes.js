const express = require("express");
const authController = require("../../controllers/mobile/auth.controller");
const { authRateLimiter } = require("../../middlewares/rateLimit.middleware");

const router = express.Router();

router.post("/register", authRateLimiter, authController.registerCustomer);
router.post("/login", authRateLimiter, authController.loginCustomer);


module.exports = router;
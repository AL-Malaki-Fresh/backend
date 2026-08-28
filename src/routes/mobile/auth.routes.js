const express = require("express");
const authController = require("../../controllers/mobile/auth.controller");
const { authRateLimiter } = require("../../middlewares/rateLimit.middleware");

const router = express.Router();

router.post("/register", authRateLimiter, authController.registerCustomer);
router.post("/login", authRateLimiter, authController.loginCustomer);
// The mobile app has always called this endpoint (see api.ts's
// REFRESH_ENDPOINT), but it was never registered here, so every refresh
// attempt 404'd and the app treated that as a failed refresh — logging
// the user out every time the access token expired.
router.post("/refresh", authRateLimiter, authController.refreshToken);


module.exports = router;
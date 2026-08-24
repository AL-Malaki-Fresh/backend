const rateLimit = require("express-rate-limit");

// Login/refresh are brute-force targets — cap attempts per IP.
// 20 requests / 15 min is generous for a real user, tight for a script.
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: "TOO_MANY_REQUESTS",
    message: "Too many attempts, please try again later.",
  },
});

module.exports = { authRateLimiter };

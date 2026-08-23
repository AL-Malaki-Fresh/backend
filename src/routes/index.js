const express = require("express");

const router = express.Router();

const { authenticate, authorizeRoles } = require("../middlewares/auth.middleware");
const adminDeliverySettingRoutes =
  require("./admin/delivery-setting.routes");
const adminUserRoutes = require("./admin/user.routes");
const adminAuthRoutes = require("./admin/auth.routes");
const adminCategoryRoutes = require("./admin/category.routes");
const adminProductRoutes = require("./admin/product.routes");
const adminOrderRoutes = require("./admin/order.routes");

// ✅ ADD THIS IMPORT
const adminDashboardRoutes = require("./admin/dashboard.routes");

// ✅ UNCOMMENT THIS - Notification routes
const adminNotificationRoutes = require("./admin/notification.routes");
// const adminUploadRoutes = require("./admin/upload.routes");

const mobileAuthRoutes = require("./mobile/auth.routes");
const mobileUserRoutes = require("./mobile/user.routes");
const mobileCategoryRoutes = require("./mobile/category.routes");
const mobileProductRoutes = require("./mobile/product.routes");
const mobileOrderRoutes = require("./mobile/order.routes");
const mobileCartRoutes = require("./mobile/cart.routes");

// Payment routes
const mobilePaymentRoutes = require("./mobile/payment.routes");

// Root route
router.get("/", (req, res) => {
  res.json({
    message: "Al Malaki Fresh API",
    version: "1.0.0",
    documentation: "/api/health",
    endpoints: {
      mobile: "/api/mobile",
      admin: "/api/admin",
      payments: "/api/mobile/payments",
    },
  });
});

router.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "API health check successful",
  });
});

// ─── Public admin route ──────────────────────────────────────────────────

router.use("/admin/auth", adminAuthRoutes);

// ─── Protected admin routes ──────────────────────────────────────────────

router.use(
  "/admin/users",
  authenticate,
  authorizeRoles("ADMIN"),
  adminUserRoutes
);

router.use(
  "/admin/categories",
  authenticate,
  authorizeRoles("ADMIN"),
  adminCategoryRoutes
);

router.use(
  "/admin/products",
  authenticate,
  authorizeRoles("ADMIN"),
  adminProductRoutes
);

router.use(
  "/admin/orders",
  authenticate,
  authorizeRoles("ADMIN"),
  adminOrderRoutes
);

// ✅ This will now work because adminDashboardRoutes is imported
router.use(
  "/admin/dashboard",
  authenticate,
  authorizeRoles("ADMIN"),
  adminDashboardRoutes
);

// ✅ UNCOMMENT THIS - Notification routes
router.use(
  "/admin/notifications",
  authenticate,
  authorizeRoles("ADMIN"),
  adminNotificationRoutes
);
   
// router.use(
//   "/admin/uploads",
//   authenticate,
//   authorizeRoles("ADMIN"),
//   adminUploadRoutes
// );

// ─── Public mobile routes ──────────────────────────────────────────────────

router.use("/mobile/auth", mobileAuthRoutes);
router.use("/mobile/categories", mobileCategoryRoutes);
router.use("/mobile/products", mobileProductRoutes);

// ─── Protected mobile routes ──────────────────────────────────────────────

router.use(
  "/mobile/users",
  authenticate,
  authorizeRoles("CUSTOMER", "ADMIN"),
  mobileUserRoutes
);
router.use(
  "/admin/delivery-settings",
  authenticate,
  authorizeRoles("ADMIN"),
  adminDeliverySettingRoutes
);
router.use(
  "/mobile/orders",
  authenticate,
  authorizeRoles("CUSTOMER", "ADMIN"),
  mobileOrderRoutes
);

router.use(
  "/mobile/cart",
  authenticate,
  authorizeRoles("CUSTOMER", "ADMIN"),
  mobileCartRoutes
);

// ─── Payment routes ────────────────────────────────────────────────────────

router.use("/mobile/payments", mobilePaymentRoutes);

module.exports = router;
const express = require("express");

const router = express.Router();

const adminNotificationController = require("../../controllers/admin/notification.controller");

router.get("/", adminNotificationController.getAdminNotifications);

router.get(
  "/unread-count",
  adminNotificationController.getUnreadNotificationsCount
);
router.get("/:id", adminNotificationController.getAdminNotificationById);


router.patch(
  "/read-all",
  adminNotificationController.markAllNotificationsAsRead
);

router.patch(
  "/:id/read",
  adminNotificationController.markNotificationAsRead
);

module.exports = router;
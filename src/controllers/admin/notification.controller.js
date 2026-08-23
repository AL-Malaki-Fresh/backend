const notificationService = require("../../services/notification.service");

const getAdminNotifications = async (req, res, next) => {
  try {
    const result = await notificationService.getAdminNotifications(req.query);

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

const getUnreadNotificationsCount = async (req, res, next) => {
  try {
    const count = await notificationService.getUnreadNotificationsCount();

    res.status(200).json({
      success: true,
      data: {
        count,
      },
    });
  } catch (error) {
    next(error);
  }
};

const markNotificationAsRead = async (req, res, next) => {
  try {
    const notification = await notificationService.markNotificationAsRead(
      req.params.id
    );

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllNotificationsAsRead();

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};
const getAdminNotificationById = async (req, res, next) => {
  try {
    const notification = await notificationService.getAdminNotificationById(
      req.params.id
    );

    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getAdminNotificationById,
};  
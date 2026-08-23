const dashboardService = require("../../services/dashboard.service");

const getDashboardStats = async (req, res, next) => {
  try {
    const stats = await dashboardService.getDashboardStats(req.query);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
};
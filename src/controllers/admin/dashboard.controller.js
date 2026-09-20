const dashboardService = require("../../services/dashboard.service");
const dailyReportService = require("../../services/dailyReport.service");

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

const getDailyReport = async (req, res, next) => {
  try {
    const report = await dailyReportService.getDailyReport(req.query);

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getDailyReport,
};
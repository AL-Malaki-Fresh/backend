const deliverySettingService = require(
  "../../services/delivery-setting.service"
);

const getDeliverySetting = async (req, res, next) => {
  try {
    const setting =
      await deliverySettingService.getDeliverySetting();

    res.status(200).json({
      success: true,
      data: setting,
    });
  } catch (error) {
    next(error);
  }
};

const updateDeliverySetting = async (req, res, next) => {
  try {
    const setting =
      await deliverySettingService.updateDeliverySetting(
        req.body
      );

    res.status(200).json({
      success: true,
      message: "Delivery setting updated successfully",
      data: setting,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDeliverySetting,
  updateDeliverySetting,
};
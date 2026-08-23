const express = require("express");
const deliverySettingController =
  require("../../controllers/admin/delivery-setting.controller");

const router = express.Router();

router.get(
  "/",
  deliverySettingController.getDeliverySetting
);

router.put(
  "/",
  deliverySettingController.updateDeliverySetting
);

module.exports = router;
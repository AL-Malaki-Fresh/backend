// src/routes/mobile/payment.routes.js

const express = require("express");

const {
  authenticate,
} = require(
  "../../middlewares/auth.middleware"
);

const paymentController = require(
  "../../controllers/mobile/payment.controller"
);

const router = express.Router();

router.post(
  "/initiate",
  authenticate,
  paymentController.initiatePayment
);

router.get(
  "/verify/:chargeId",
  authenticate,
  paymentController.verifyPayment
);

router.post(
  "/tap-webhook",
  paymentController.handleTapWebhook
);

module.exports = router;
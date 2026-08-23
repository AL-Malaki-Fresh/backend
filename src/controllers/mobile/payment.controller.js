// src/controllers/mobile/payment.controller.js

const tapService = require(
  "../../services/tap.service"
);

const orderService = require(
  "../../services/order.service"
);

// ─── Tap Statuses ───────────────────────────────────────────────────────────

const SUCCESSFUL_TAP_STATUSES = [
  "AUTHORIZED",
  "CAPTURED",
];

const FAILED_TAP_STATUSES = [
  "FAILED",
  "DECLINED",
  "CANCELLED",
  "VOID",
  "ABANDONED",
  "TIMEDOUT",
  "RESTRICTED",
  "UNKNOWN",
];

const REUSABLE_TAP_STATUSES = [
  "INITIATED",
  "PENDING",
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .toUpperCase();
}

function normalizeMoney(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return null;
  }

  return Number(amount.toFixed(2));
}

function mapTapStatusToPaymentStatus(
  tapStatus
) {
  const normalizedStatus =
    normalizeStatus(tapStatus);

  if (
    SUCCESSFUL_TAP_STATUSES.includes(
      normalizedStatus
    )
  ) {
    return "PAID";
  }

  if (
    FAILED_TAP_STATUSES.includes(
      normalizedStatus
    )
  ) {
    return "FAILED";
  }

  return "PENDING";
}

function isTapPaymentSuccessful(
  tapStatus
) {
  return SUCCESSFUL_TAP_STATUSES.includes(
    normalizeStatus(tapStatus)
  );
}

function createControllerError(
  message,
  statusCode,
  code
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.code = code;

  return error;
}

function getCustomerFromOrder(
  user,
  order
) {
  const deliveryAddress =
    order.deliveryAddress || {};

  const fullName = String(
    deliveryAddress.fullName || ""
  ).trim();

  const nameParts = fullName
    .split(/\s+/)
    .filter(Boolean);

  return {
    firstName:
      user.firstName ||
      nameParts[0] ||
      "Customer",

    lastName:
      user.lastName ||
      nameParts.slice(1).join(" ") ||
      "AlMalaki",

    email:
      user.email ||
      deliveryAddress.email ||
      null,

    phone:
      user.phone ||
      deliveryAddress.phone ||
      null,
  };
}

function validateTapChargeAgainstOrder(
  charge,
  order
) {
  const expectedAmount =
    normalizeMoney(
      order.totalAmount
    );

  const receivedAmount =
    normalizeMoney(
      charge.amount
    );

  const expectedCurrency = String(
    process.env.TAP_CURRENCY ||
      "QAR"
  )
    .trim()
    .toUpperCase();

  const receivedCurrency = String(
    charge.currency || ""
  )
    .trim()
    .toUpperCase();

  if (
    expectedAmount === null ||
    receivedAmount === null ||
    expectedAmount !==
      receivedAmount ||
    expectedCurrency !==
      receivedCurrency
  ) {
    throw createControllerError(
      "Tap payment amount or currency does not match the order",
      409,
      "PAYMENT_AMOUNT_MISMATCH"
    );
  }
}

// ─── Initiate Payment ───────────────────────────────────────────────────────

const initiatePayment = async (
  req,
  res,
  next
) => {
  try {
    const userId = req.user.id;

    const orderId = String(
      req.body.orderId || ""
    ).trim();

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message:
          "Order ID is required",
      });
    }

    const order =
      await orderService.getMyOrderById(
        userId,
        orderId
      );

    const currentPaymentStatus =
      normalizeStatus(
        order.paymentStatus
      );

    if (
      currentPaymentStatus === "PAID"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This order has already been paid",
      });
    }

    const paymentMethod =
      normalizeStatus(
        order.paymentMethod
      );

    if (
      paymentMethod !== "CARD"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This order is not configured for card payment",
      });
    }

    /*
     * Reuse an existing Tap charge when the order
     * already has an active payment.
     */
    if (order.paymentId) {
      let existingCharge = null;

      try {
        existingCharge =
          await tapService.retrieveCharge(
            order.paymentId
          );
      } catch (error) {
        console.warn(
          "Could not retrieve existing Tap charge:",
          {
            orderId:
              order.id,

            paymentId:
              order.paymentId,

            message:
              error.message,
          }
        );
      }

      if (existingCharge) {
        const existingStatus =
          normalizeStatus(
            existingCharge.status
          );

        /*
         * An initiated charge can be reused instead
         * of creating another Tap transaction.
         */
        if (
          REUSABLE_TAP_STATUSES.includes(
            existingStatus
          )
        ) {
          const existingPaymentUrl =
            existingCharge
              .transaction?.url ||
            null;

          if (existingPaymentUrl) {
            console.log(
              "♻️ Reusing existing Tap charge:",
              {
                orderId:
                  order.id,

                chargeId:
                  existingCharge.id,

                status:
                  existingCharge.status,
              }
            );

            return res.status(200).json({
              success: true,

              data: {
                chargeId:
                  existingCharge.id,

                paymentUrl:
                  existingPaymentUrl,

                status:
                  existingCharge.status,
              },
            });
          }
        }

        /*
         * Tap already reports this charge as paid.
         * Synchronize the order automatically.
         */
        if (
          SUCCESSFUL_TAP_STATUSES.includes(
            existingStatus
          )
        ) {
          await orderService
            .updateOrderPaymentFromTap(
              existingCharge.id,
              existingCharge.status
            );

          return res.status(409).json({
            success: false,
            message:
              "This order has already been paid",
          });
        }
      }
    }

    const customer =
      getCustomerFromOrder(
        req.user,
        order
      );

    if (!customer.email) {
      return res.status(400).json({
        success: false,
        message:
          "Customer email is required for card payment",
      });
    }

    /*
     * The Tap service requires a payment object.
     * Since payment data is stored directly on the
     * order, construct it from the existing order.
     *
     * Do not accept the amount from the frontend.
     */
    const payment = {
      id:
        order.paymentId ||
        order.id,

      amount:
        order.totalAmount,

      currency:
        process.env.TAP_CURRENCY ||
        "QAR",

      idempotencyKey:
        `tap_order_${order.id}`,
    };

    const charge =
      await tapService
        .createCardChargeForOrder({
          order,
          customer,
          payment,
        });

    const paymentUrl =
      charge.transaction?.url ||
      null;

    if (!paymentUrl) {
      throw createControllerError(
        "Tap did not return a payment URL",
        502,
        "TAP_PAYMENT_URL_MISSING"
      );
    }

    /*
     * Store the Tap charge ID on the order.
     */
    await orderService
      .updateOrderPaymentId(
        order.id,
        charge.id
      );

    console.log(
      "✅ Tap charge initiated:",
      {
        orderId:
          order.id,

        orderNumber:
          order.orderNumber,

        chargeId:
          charge.id,

        tapStatus:
          charge.status,

        amount:
          charge.amount,

        currency:
          charge.currency,
      }
    );

    return res.status(200).json({
      success: true,

      data: {
        chargeId:
          charge.id,

        paymentUrl,

        status:
          charge.status,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// ─── Verify Payment ─────────────────────────────────────────────────────────

const verifyPayment = async (
  req,
  res,
  next
) => {
  try {
    const userId = req.user.id;

    const chargeId = String(
      req.params.chargeId || ""
    ).trim();

    if (!chargeId) {
      return res.status(400).json({
        success: false,
        message:
          "Tap charge ID is required",
      });
    }

    /*
     * Find the associated order first and confirm
     * that it belongs to the authenticated customer.
     */
    const order =
      await orderService
        .getOrderByPaymentId(
          chargeId
        );

    if (!order) {
      return res.status(404).json({
        success: false,
        message:
          "Order not found for this payment",
      });
    }

    if (
      String(order.userId) !==
      String(userId)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to access this payment",
      });
    }

    const charge =
      await tapService.retrieveCharge(
        chargeId
      );

    validateTapChargeAgainstOrder(
      charge,
      order
    );

    const isPaid =
      isTapPaymentSuccessful(
        charge.status
      );

    /*
     * Card payment status is always synchronized
     * automatically using the Tap response.
     */
    const updatedOrder =
      await orderService
        .updateOrderPaymentFromTap(
          charge.id,
          charge.status
        );

    console.log(
      "✅ Tap charge verified:",
      {
        orderId:
          updatedOrder.id,

        orderNumber:
          updatedOrder.orderNumber,

        chargeId:
          charge.id,

        tapStatus:
          charge.status,

        paymentStatus:
          updatedOrder.paymentStatus,

        orderStatus:
          updatedOrder.status,

        isPaid,
      }
    );

    return res.status(200).json({
      success: true,

      data: {
        chargeId:
          charge.id,

        status:
          charge.status,

        paymentStatus:
          updatedOrder.paymentStatus,

        orderStatus:
          updatedOrder.status,

        isPaid,

        amount:
          charge.amount,

        currency:
          charge.currency,

        response:
          charge.response ||
          null,

        gateway:
          charge.gateway ||
          null,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// ─── Tap Webhook ────────────────────────────────────────────────────────────

const handleTapWebhook = async (
  req,
  res
) => {
  try {
    const payload =
      req.body || {};

    const chargeId = String(
      payload.id || ""
    ).trim();

    if (!chargeId) {
      console.warn(
        "⚠️ Tap webhook received without charge ID"
      );

      return res.status(200).json({
        received: true,
      });
    }

    console.log(
      "🔔 Tap webhook received:",
      {
        chargeId,

        payloadStatus:
          payload.status ||
          null,
      }
    );

    /*
     * Retrieve the charge directly from Tap.
     * Do not trust the webhook status by itself.
     */
    const charge =
      await tapService.retrieveCharge(
        chargeId
      );

    const order =
      await orderService
        .getOrderByPaymentId(
          charge.id
        );

    if (!order) {
      console.warn(
        "⚠️ Order not found for Tap charge:",
        charge.id
      );

      return res.status(200).json({
        received: true,
      });
    }

    validateTapChargeAgainstOrder(
      charge,
      order
    );

    const isPaid =
      isTapPaymentSuccessful(
        charge.status
      );

    /*
     * Card payment is updated automatically.
     * This function does not update cash payments.
     */
    const updatedOrder =
      await orderService
        .updateOrderPaymentFromTap(
          charge.id,
          charge.status
        );

    console.log(
      "✅ Order updated from Tap webhook:",
      {
        orderId:
          updatedOrder.id,

        orderNumber:
          updatedOrder.orderNumber,

        chargeId:
          charge.id,

        tapStatus:
          charge.status,

        paymentStatus:
          updatedOrder.paymentStatus,

        orderStatus:
          updatedOrder.status,

        isPaid,
      }
    );

    return res.status(200).json({
      received: true,
    });
  } catch (error) {
    console.error(
      "❌ Tap webhook processing failed:",
      {
        message:
          error.message,

        code:
          error.code,

        statusCode:
          error.statusCode,

        tapResponse:
          error.tapResponse ||
          null,
      }
    );

    /*
     * Return 200 so Tap does not endlessly retry
     * because of an internal application problem.
     */
    return res.status(200).json({
      received: true,
    });
  }
};

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  initiatePayment,
  verifyPayment,
  handleTapWebhook,
};
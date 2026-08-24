const axios = require("axios");

const TAP_API_URL = "https://api.tap.company/v2";

const tapClient = axios.create({
  baseURL: TAP_API_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Validates the required Tap environment variables.
 */
function validateTapConfiguration() {
  const requiredVariables = [
    "TAP_SECRET_KEY",
    "TAP_MERCHANT_ID",
    "TAP_RETURN_URL",
  ];

  const missingVariables = requiredVariables.filter(
    (variableName) =>
      !String(process.env[variableName] || "").trim()
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing Tap configuration: ${missingVariables.join(", ")}`
    );
  }

  const secretKey = String(
    process.env.TAP_SECRET_KEY || ""
  ).trim();

  if (
    process.env.NODE_ENV !== "production" &&
    !secretKey.startsWith("sk_test_")
  ) {
    console.warn(
      "Warning: TAP_SECRET_KEY does not appear to be a test key."
    );
  }
}

/**
 * Creates the headers required by Tap.
 */
function getTapHeaders() {
  return {
    Authorization: `Bearer ${String(
      process.env.TAP_SECRET_KEY || ""
    ).trim()}`,
    lang_code: "en",
  };
}

/**
 * Converts a Prisma Decimal or string amount
 * to a valid JavaScript number.
 */
function toAmount(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid payment amount");
  }

  return Number(amount.toFixed(2));
}

/**
 * Validates the frontend return URL.
 */
function validateReturnUrl() {
  const returnUrl = String(
    process.env.TAP_RETURN_URL || ""
  ).trim();

  try {
    const parsedUrl = new URL(returnUrl);

    if (
      parsedUrl.protocol !== "http:" &&
      parsedUrl.protocol !== "https:"
    ) {
      throw new Error("Invalid protocol");
    }
  } catch {
    throw new Error(
      "TAP_RETURN_URL must be a valid HTTP or HTTPS URL"
    );
  }

  return returnUrl;
}

/**
 * Extracts an error description from a Tap response.
 */
function getTapErrorDetails(tapResponse) {
  const firstError = tapResponse?.errors?.[0];

  return {
    code:
      firstError?.code ||
      tapResponse?.code ||
      null,

    message:
      firstError?.description ||
      firstError?.message ||
      tapResponse?.message ||
      null,
  };
}

/**
 * Converts an Axios/Tap error into an error that
 * can be understood by the payment controller.
 */
function createTapServiceError({
  error,
  fallbackMessage,
  fallbackCode,
}) {
  const tapResponse =
    error.response?.data || null;

  const tapDetails =
    getTapErrorDetails(tapResponse);

  const serviceError = new Error(
    tapDetails.message ||
      error.message ||
      fallbackMessage
  );

  serviceError.code =
    tapDetails.code || fallbackCode;

  serviceError.statusCode =
    error.response?.status || 502;

  serviceError.tapResponse =
    tapResponse;

  return serviceError;
}

/**
 * Creates a Tap hosted card checkout for
 * an existing AlMalaki Fresh order.
 */
async function createCardChargeForOrder({
  order,
  customer,
  payment,
}) {
  validateTapConfiguration();

  if (!order?.id) {
    throw new Error("Order ID is missing");
  }

  if (!order?.orderNumber) {
    throw new Error("Order number is missing");
  }

  if (!payment?.id) {
    throw new Error("Payment ID is missing");
  }

  if (!payment?.idempotencyKey) {
    throw new Error(
      "Payment idempotency key is missing"
    );
  }

  const customerEmail = String(
    customer?.email || ""
  ).trim();

  if (!customerEmail) {
    throw new Error("Customer email is missing");
  }

  const amount = toAmount(
    payment.amount || order.totalAmount
  );

  const currency = String(
    payment.currency ||
      process.env.TAP_CURRENCY ||
      "QAR"
  )
    .trim()
    .toUpperCase();

  const merchantId = String(
    process.env.TAP_MERCHANT_ID || ""
  ).trim();

  const returnUrl = validateReturnUrl();

  const payload = {
    amount,
    currency,

    customer_initiated: true,
    threeDSecure: true,
    save_card: false,

    description:
      `AlMalaki Fresh order ${order.orderNumber}`,

    metadata: {
      orderId: String(order.id),
      orderNumber: String(
        order.orderNumber
      ),
      userId: String(
        order.userId || ""
      ),
      paymentId: String(
        payment.id
      ),
    },

    reference: {
      transaction:
        `txn_${payment.id}`,

      order:
        String(order.id),

      idempotent:
        String(
          payment.idempotencyKey
        ),
    },

    customer: {
      first_name:
        String(
          customer.firstName ||
            "Customer"
        ).trim(),

      last_name:
        String(
          customer.lastName ||
            "AlMalaki"
        ).trim(),

      email: customerEmail,
    },

    /*
     * Use exactly the merchant ID supplied by Tap.
     * Do not automatically replace it using the
     * numeric ID returned in a charge response.
     */
    merchant: {
      id: merchantId,
    },

    source: {
      id: "src_card",
    },

    redirect: {
      url: returnUrl,
    },
  };

  /*
   * Tap cannot call localhost.
   * Add post.url only when it is a public HTTPS URL.
   */
  const webhookUrl = String(
    process.env.TAP_WEBHOOK_URL || ""
  ).trim();

  if (
    webhookUrl &&
    webhookUrl.startsWith("https://")
  ) {
    payload.post = {
      url: webhookUrl,
    };
  }

  console.log("Creating Tap charge:", {
    orderId: order.id,
    orderNumber: order.orderNumber,
    userId: order.userId,
    paymentId: payment.id,

    amount,
    currency,

    idempotencyKey:
      payment.idempotencyKey,

    requestMerchantId:
      payload.merchant.id,

    customerLoaded: {
      firstName: Boolean(
        payload.customer.first_name
      ),
      lastName: Boolean(
        payload.customer.last_name
      ),
      email: Boolean(
        payload.customer.email
      ),
    },

    source: payload.source.id,
    returnUrl,

    webhookEnabled:
      Boolean(payload.post?.url),
  });

  try {
    const response = await tapClient.post(
      "/charges/",
      payload,
      {
        headers: getTapHeaders(),
      }
    );

    const charge = response.data;

    console.log("Tap charge result:", {
      chargeId: charge?.id,
      status: charge?.status,

      responseCode:
        charge?.response?.code,

      responseMessage:
        charge?.response?.message,

      amount: charge?.amount,
      currency: charge?.currency,

      transactionUrl:
        charge?.transaction?.url,

      redirectStatus:
        charge?.redirect?.status,

      liveMode:
        charge?.live_mode,

      requestMerchantId:
        merchantId,

      returnedMerchantId:
        charge?.merchant?.id ||
        charge?.merchant_id ||
        null,
    });

    if (!charge?.id) {
      throw new Error(
        "Tap did not return a charge ID"
      );
    }

    const chargeStatus = String(
      charge.status || ""
    ).toUpperCase();

    if (
      chargeStatus === "INITIATED" &&
      !charge.transaction?.url
    ) {
      throw new Error(
        "Tap initiated the charge but did not return a payment URL"
      );
    }

    return charge;
  } catch (error) {
    console.error(
      "Tap create charge failed:",
      {
        httpStatus:
          error.response?.status ||
          null,

        message:
          error.message,

        tapResponse:
          error.response?.data ||
          null,
      }
    );

    throw createTapServiceError({
      error,
      fallbackMessage:
        "Tap failed to create the payment charge",
      fallbackCode:
        "TAP_CHARGE_CREATION_FAILED",
    });
  }
}

/**
 * Retrieves the current charge status from Tap.
 */
async function retrieveCharge(chargeId) {
  validateTapConfiguration();

  const normalizedChargeId = String(
    chargeId || ""
  ).trim();

  if (!normalizedChargeId) {
    throw new Error(
      "Tap charge ID is required"
    );
  }

  try {
    const response = await tapClient.get(
      `/charges/${encodeURIComponent(
        normalizedChargeId
      )}`,
      {
        headers: getTapHeaders(),
      }
    );

    const charge = response.data;

    const configuredMerchantId = String(
      process.env.TAP_MERCHANT_ID || ""
    ).trim();

    const returnedMerchantId =
      charge?.merchant?.id ||
      charge?.merchant_id ||
      null;

    /*
     * Log only safe authentication diagnostics.
     * Do not log authentication_token.
     */
    const safeAuthentication =
      charge?.authentication
        ? {
            id:
              charge.authentication.id ||
              null,

            status:
              charge.authentication.status ||
              null,

            provider:
              charge.authentication.provider ||
              null,

            protocolVersion:
              charge.authentication
                .protocol_version ||
              null,

            transactionStatus:
              charge.authentication
                .transaction_status ||
              null,

            paResStatus:
              charge.authentication
                .paRes_status ||
              null,

            mode:
              charge.authentication.mode ||
              null,
          }
        : null;

    console.dir(
      {
        chargeId:
          charge?.id,

        status:
          charge?.status,

        response:
          charge?.response,

        amount:
          charge?.amount,

        currency:
          charge?.currency,

        liveMode:
          charge?.live_mode,

        cardThreeDSecure:
          charge?.card_threeDSecure,

        authentication:
          safeAuthentication,

        security:
          charge?.security,

        transaction: {
          authorizationId:
            charge?.transaction
              ?.authorization_id ||
            null,

          created:
            charge?.transaction
              ?.created ||
            null,

          amount:
            charge?.transaction
              ?.amount ||
            null,

          currency:
            charge?.transaction
              ?.currency ||
            null,

          asynchronous:
            charge?.transaction
              ?.asynchronous,

          expiry:
            charge?.transaction
              ?.expiry ||
            null,

          date:
            charge?.transaction
              ?.date ||
            null,
        },

        redirect:
          charge?.redirect,

        source:
          charge?.source,

        merchant:
          charge?.merchant,

        /*
         * The returned ID is nested in
         * charge.merchant.id in your response.
         */
        returnedMerchantId,

        /*
         * This is the value your application sent.
         */
        configuredMerchantId,

        gateway:
          charge?.gateway,

        acquirer:
          charge?.acquirer,

        activities:
          charge?.activities,
      },
      {
        depth: null,
      }
    );

    return charge;
  } catch (error) {
    console.error(
      "Tap retrieve charge failed:",
      {
        chargeId:
          normalizedChargeId,

        httpStatus:
          error.response?.status ||
          null,

        message:
          error.message,

        tapResponse:
          error.response?.data ||
          null,
      }
    );

    throw createTapServiceError({
      error,
      fallbackMessage:
        "Unable to retrieve Tap charge",
      fallbackCode:
        "TAP_CHARGE_RETRIEVAL_FAILED",
    });
  }
}

module.exports = {
  createCardChargeForOrder,
  retrieveCharge,
  validateTapConfiguration,
};
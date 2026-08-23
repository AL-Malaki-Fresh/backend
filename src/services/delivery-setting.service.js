const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");

const DEFAULT_SETTING_ID = "DEFAULT";

const createError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const normalizeFee = (value) => {
  try {
    const fee = new Prisma.Decimal(value ?? 0).toDecimalPlaces(2);

    if (fee.isNegative()) {
      throw createError(
        "Delivery fee cannot be negative",
        400,
        "INVALID_DELIVERY_FEE"
      );
    }

    return fee;
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }

    throw createError(
      "Invalid delivery fee",
      400,
      "INVALID_DELIVERY_FEE"
    );
  }
};

const normalizeCurrency = (value) => {
  const currency = String(value || "QAR")
    .trim()
    .toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw createError(
      "Currency must contain exactly 3 letters",
      400,
      "INVALID_CURRENCY"
    );
  }

  return currency;
};

const getDeliverySetting = async (db = prisma) => {
  return db.deliverySetting.upsert({
    where: {
      id: DEFAULT_SETTING_ID,
    },
    update: {},
    create: {
      id: DEFAULT_SETTING_ID,
      fee: new Prisma.Decimal(0),
      currency: "QAR",
    },
  });
};

const getDeliveryFee = async (db = prisma) => {
  const setting = await getDeliverySetting(db);

  return setting.fee;
};

const updateDeliverySetting = async (
  { fee, currency },
  db = prisma
) => {
  const normalizedFee = normalizeFee(fee);
  const normalizedCurrency = normalizeCurrency(currency);

  return db.deliverySetting.upsert({
    where: {
      id: DEFAULT_SETTING_ID,
    },
    update: {
      fee: normalizedFee,
      currency: normalizedCurrency,
    },
    create: {
      id: DEFAULT_SETTING_ID,
      fee: normalizedFee,
      currency: normalizedCurrency,
    },
  });
};

module.exports = {
  getDeliverySetting,
  getDeliveryFee,
  updateDeliverySetting,
};
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

const MAX_TEXT_FIELD_LENGTHS = {
  businessName: 150,
  businessEmail: 255,
  businessPhone: 30,
  country: 100,
  city: 100,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// All the "Market Information" fields are optional — an admin may only
// want to set the delivery fee/currency for now — but if a value IS
// provided it gets trimmed and length/format checked.
const normalizeOptionalText = (value, field) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  if (text.length > MAX_TEXT_FIELD_LENGTHS[field]) {
    throw createError(
      `${field} must be at most ${MAX_TEXT_FIELD_LENGTHS[field]} characters`,
      400,
      "INVALID_MARKET_INFO"
    );
  }

  if (field === "businessEmail" && !EMAIL_RE.test(text)) {
    throw createError("Invalid business email", 400, "INVALID_MARKET_INFO");
  }

  return text;
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
  { fee, currency, businessName, businessEmail, businessPhone, country, city },
  db = prisma
) => {
  const normalizedFee = normalizeFee(fee);
  const normalizedCurrency = normalizeCurrency(currency);

  const data = {
    fee: normalizedFee,
    currency: normalizedCurrency,
    businessName: normalizeOptionalText(businessName, "businessName"),
    businessEmail: normalizeOptionalText(businessEmail, "businessEmail"),
    businessPhone: normalizeOptionalText(businessPhone, "businessPhone"),
    country: normalizeOptionalText(country, "country"),
    city: normalizeOptionalText(city, "city"),
  };

  return db.deliverySetting.upsert({
    where: {
      id: DEFAULT_SETTING_ID,
    },
    update: data,
    create: {
      id: DEFAULT_SETTING_ID,
      ...data,
    },
  });
};

module.exports = {
  getDeliverySetting,
  getDeliveryFee,
  updateDeliverySetting,
};
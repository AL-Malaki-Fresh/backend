const bcrypt = require("bcrypt");
const prisma = require("../config/prisma");

const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require("../utils/jwt");

const ALLOWED_ROLES = ["CUSTOMER", "ADMIN", "DELIVERY"];
const ALLOWED_ADDRESS_TYPES = ["HOME", "WORK", "OTHER"];

const createError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const safeUserSelect = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  role: true,
  isVerified: true,
  isActive: true,
  lastLogin: true,
  createdAt: true,
  updatedAt: true,
};

const normalizeEmail = (email) => {
  if (!email) return null;
  return String(email).trim().toLowerCase();
};

const normalizePhone = (phone) => {
  if (!phone) return null;
  return String(phone).trim();
};

const normalizeString = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const trimmedValue = String(value).trim();
  return trimmedValue || null;
};

const normalizeNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return undefined;
  }

  return numberValue;
};

const parseBoolean = (value) => {
  if (value === undefined) return undefined;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
};

const normalizeRole = (role) => {
  if (!role) return undefined;
  return String(role).trim().toUpperCase();
};

const validateRole = (role) => {
  if (!ALLOWED_ROLES.includes(role)) {
    throw createError("Invalid user role", 400, "INVALID_USER_ROLE");
  }
};

const validateAddressType = (addressType) => {
  if (!ALLOWED_ADDRESS_TYPES.includes(addressType)) {
    throw createError("Invalid address type", 400, "INVALID_ADDRESS_TYPE");
  }
};

const findUserOrFail = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: safeUserSelect,
  });

  if (!user) {
    throw createError("User not found", 404, "USER_NOT_FOUND");
  }

  return user;
};

const checkEmailOrPhoneUniqueness = async ({
  email,
  phone,
  excludeUserId = null,
}) => {
  const filters = [];

  if (email) {
    filters.push({ email });
  }

  if (phone) {
    filters.push({ phone });
  }

  if (filters.length === 0) return;

  const existingUser = await prisma.user.findFirst({
    where: {
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      OR: filters,
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    throw createError(
      "Email or phone already used by another user",
      409,
      "EMAIL_OR_PHONE_ALREADY_USED"
    );
  }
};

const buildSafeUser = (user, lastLogin = user.lastLogin) => {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    isVerified: user.isVerified,
    isActive: user.isActive,
    lastLogin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

const createUser = async ({
  email,
  phone,
  password,
  firstName,
  lastName,
  avatarUrl,
  role = "CUSTOMER",
  isVerified = false,
  isActive = true,
}) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);
  const normalizedRole = normalizeRole(role);

  if (!normalizedEmail) {
    throw createError("Email is required", 400, "EMAIL_REQUIRED");
  }

  if (!password) {
    throw createError("Password is required", 400, "PASSWORD_REQUIRED");
  }

  if (password.length < 8) {
    throw createError(
      "Password must be at least 8 characters",
      400,
      "PASSWORD_TOO_SHORT"
    );
  }

  validateRole(normalizedRole);

  const activeValue = parseBoolean(isActive);
  const verifiedValue = parseBoolean(isVerified);

  if (activeValue === undefined) {
    throw createError(
      "isActive must be true or false",
      400,
      "INVALID_ACTIVE_STATUS"
    );
  }

  if (verifiedValue === undefined) {
    throw createError(
      "isVerified must be true or false",
      400,
      "INVALID_VERIFIED_STATUS"
    );
  }

  await checkEmailOrPhoneUniqueness({
    email: normalizedEmail,
    phone: normalizedPhone,
  });

  const passwordHash = await bcrypt.hash(password, 10);

  return prisma.user.create({
    data: {
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash,
      firstName: normalizeString(firstName),
      lastName: normalizeString(lastName),
      avatarUrl: normalizeString(avatarUrl),
      role: normalizedRole,
      isVerified: verifiedValue,
      isActive: activeValue,
    },
    select: safeUserSelect,
  });
};

const loginUser = async ({ email, password, allowedRole }) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    throw createError(
      "Email and password are required",
      400,
      "EMAIL_PASSWORD_REQUIRED"
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (!user || !user.passwordHash) {
    throw createError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordCorrect) {
    throw createError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  if (!user.isActive) {
    throw createError("User account is inactive", 403, "USER_INACTIVE");
  }

  const allowedRoles = Array.isArray(allowedRole)
    ? allowedRole.map((role) => normalizeRole(role))
    : allowedRole
    ? [normalizeRole(allowedRole)]
    : [];

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    throw createError("Access denied for this role", 403, "ROLE_NOT_ALLOWED");
  }

  const lastLogin = new Date();

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      lastLogin,
    },
  });

  const safeUser = buildSafeUser(user, lastLogin);

  const accessToken = generateAccessToken(safeUser);
  const refreshToken = generateRefreshToken(safeUser);

  return {
    user: safeUser,
    accessToken,
    refreshToken,

    // temporary compatibility with old frontend code
    token: accessToken,
  };
};

const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    throw createError(
      "Refresh token is required",
      400,
      "REFRESH_TOKEN_REQUIRED"
    );
  }

  let decoded;

  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (error) {
    throw createError(
      "Invalid or expired refresh token",
      401,
      "INVALID_REFRESH_TOKEN"
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      id: decoded.id,
    },
    select: safeUserSelect,
  });

  if (!user) {
    throw createError("User not found", 401, "USER_NOT_FOUND");
  }

  if (!user.isActive) {
    throw createError("User account is inactive", 403, "USER_INACTIVE");
  }

  const accessToken = generateAccessToken(user);

  return {
    accessToken,

    // temporary compatibility with old frontend code
    token: accessToken,
  };
};

const getAllUsers = async ({
  page = 1,
  limit = 10,
  search,
  role,
  isActive,
} = {}) => {
  const rawPage = Number(page);
  const rawLimit = Number(limit);

  const pageNumber =
    Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  const limitNumber =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), 100)
      : 10;

  const skip = (pageNumber - 1) * limitNumber;

  const searchText = typeof search === "string" ? search.trim() : "";
  const activeFilter = parseBoolean(isActive);
  const roleFilter = role ? normalizeRole(role) : undefined;

  if (roleFilter) {
    validateRole(roleFilter);
  }

  if (isActive !== undefined && activeFilter === undefined) {
    throw createError(
      "isActive must be true or false",
      400,
      "INVALID_ACTIVE_STATUS"
    );
  }

  const where = {
    ...(roleFilter ? { role: roleFilter } : {}),
    ...(activeFilter !== undefined ? { isActive: activeFilter } : {}),
    ...(searchText
      ? {
          OR: [
            { email: { contains: searchText, mode: "insensitive" } },
            { phone: { contains: searchText, mode: "insensitive" } },
            { firstName: { contains: searchText, mode: "insensitive" } },
            { lastName: { contains: searchText, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limitNumber,
      select: safeUserSelect,
    }),
    prisma.user.count({
      where,
    }),
  ]);

  return {
    data: users,
    pagination: {
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const getUserById = async (id) => {
  const user = await prisma.user.findUnique({
    where: {
      id,
    },
    select: {
      ...safeUserSelect,
      addresses: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      },
      orders: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          totalAmount: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!user) {
    throw createError("User not found", 404, "USER_NOT_FOUND");
  }

  return user;
};

const updateUser = async (
  id,
  {
    email,
    phone,
    firstName,
    lastName,
    avatarUrl,
    role,
    isVerified,
  }
) => {
  await findUserOrFail(id);

  const normalizedEmail =
    email !== undefined ? normalizeEmail(email) : undefined;

  const normalizedPhone =
    phone !== undefined ? normalizePhone(phone) : undefined;

  const normalizedRole = role !== undefined ? normalizeRole(role) : undefined;
  const verifiedValue = parseBoolean(isVerified);

  if (email !== undefined && !normalizedEmail) {
    throw createError("Email cannot be empty", 400, "EMAIL_REQUIRED");
  }

  if (normalizedRole) {
    validateRole(normalizedRole);
  }

  if (isVerified !== undefined && verifiedValue === undefined) {
    throw createError(
      "isVerified must be true or false",
      400,
      "INVALID_VERIFIED_STATUS"
    );
  }

  await checkEmailOrPhoneUniqueness({
    email: normalizedEmail,
    phone: normalizedPhone,
    excludeUserId: id,
  });

  return prisma.user.update({
    where: {
      id,
    },
    data: {
      ...(email !== undefined ? { email: normalizedEmail } : {}),
      ...(phone !== undefined ? { phone: normalizedPhone } : {}),
      ...(firstName !== undefined ? { firstName: normalizeString(firstName) } : {}),
      ...(lastName !== undefined ? { lastName: normalizeString(lastName) } : {}),
      ...(avatarUrl !== undefined ? { avatarUrl: normalizeString(avatarUrl) } : {}),
      ...(role !== undefined ? { role: normalizedRole } : {}),
      ...(isVerified !== undefined ? { isVerified: verifiedValue } : {}),
    },
    select: safeUserSelect,
  });
};

const updateUserStatus = async (id, isActive) => {
  await findUserOrFail(id);

  const activeValue = parseBoolean(isActive);

  if (activeValue === undefined) {
    throw createError(
      "isActive must be true or false",
      400,
      "INVALID_ACTIVE_STATUS"
    );
  }

  return prisma.user.update({
    where: {
      id,
    },
    data: {
      isActive: activeValue,
    },
    select: safeUserSelect,
  });
};

const changeUserPassword = async (id, newPassword) => {
  await findUserOrFail(id);

  if (!newPassword || newPassword.length < 8) {
    throw createError(
      "Password must be at least 8 characters",
      400,
      "PASSWORD_TOO_SHORT"
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  return prisma.user.update({
    where: {
      id,
    },
    data: {
      passwordHash,
    },
    select: safeUserSelect,
  });
};

const deleteUser = async (id) => {
  await findUserOrFail(id);

  await prisma.user.delete({
    where: {
      id,
    },
  });

  return {
    message: "User deleted successfully",
  };
};

const getMyProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      ...safeUserSelect,
      addresses: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!user) {
    throw createError("User not found", 404, "USER_NOT_FOUND");
  }

  return user;
};

const updateMyProfile = async (
  userId,
  { firstName, lastName, phone, avatarUrl }
) => {
  const normalizedPhone =
    phone !== undefined ? normalizePhone(phone) : undefined;

  await checkEmailOrPhoneUniqueness({
    phone: normalizedPhone,
    excludeUserId: userId,
  });

  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      ...(firstName !== undefined ? { firstName: normalizeString(firstName) } : {}),
      ...(lastName !== undefined ? { lastName: normalizeString(lastName) } : {}),
      ...(phone !== undefined ? { phone: normalizedPhone } : {}),
      ...(avatarUrl !== undefined ? { avatarUrl: normalizeString(avatarUrl) } : {}),
    },
    select: safeUserSelect,
  });
};

const changeMyPassword = async (userId, { currentPassword, newPassword }) => {
  if (!currentPassword || !newPassword) {
    throw createError(
      "Current password and new password are required",
      400,
      "PASSWORDS_REQUIRED"
    );
  }

  if (newPassword.length < 8) {
    throw createError(
      "Password must be at least 8 characters",
      400,
      "PASSWORD_TOO_SHORT"
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw createError("User not found", 404, "USER_NOT_FOUND");
  }

  if (!user.passwordHash) {
    throw createError(
      "Password login is not enabled for this account",
      400,
      "PASSWORD_NOT_ENABLED"
    );
  }

  const isPasswordCorrect = await bcrypt.compare(
    currentPassword,
    user.passwordHash
  );

  if (!isPasswordCorrect) {
    throw createError(
      "Current password is incorrect",
      401,
      "CURRENT_PASSWORD_INCORRECT"
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      passwordHash,
    },
  });

  return {
    message: "Password changed successfully",
  };
};

const getMyAddresses = async (userId) => {
  return prisma.userAddress.findMany({
    where: {
      userId,
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
};

const createMyAddress = async (
  userId,
  {
    addressLine1,
    addressLine2,
    city,
    state,
    country = "Qatar",
    postalCode,
    latitude,
    longitude,
    isDefault = false,
    addressType = "HOME",
  }
) => {
  const normalizedAddressLine1 = normalizeString(addressLine1);
  const normalizedCity = normalizeString(city);
  const normalizedAddressType = normalizeRole(addressType);

  if (!normalizedAddressLine1 || !normalizedCity) {
    throw createError(
      "Address line 1 and city are required",
      400,
      "ADDRESS_REQUIRED"
    );
  }

  validateAddressType(normalizedAddressType);

  const defaultValue = parseBoolean(isDefault);

  if (defaultValue === undefined) {
    throw createError(
      "isDefault must be true or false",
      400,
      "INVALID_DEFAULT_STATUS"
    );
  }

  return prisma.$transaction(async (tx) => {
    if (defaultValue) {
      await tx.userAddress.updateMany({
        where: {
          userId,
        },
        data: {
          isDefault: false,
        },
      });
    }

    return tx.userAddress.create({
      data: {
        userId,
        addressLine1: normalizedAddressLine1,
        addressLine2: normalizeString(addressLine2),
        city: normalizedCity,
        state: normalizeString(state),
        country: normalizeString(country) || "Qatar",
        postalCode: normalizeString(postalCode),
        latitude: normalizeNumber(latitude),
        longitude: normalizeNumber(longitude),
        isDefault: defaultValue,
        addressType: normalizedAddressType,
      },
    });
  });
};

const updateMyAddress = async (
  userId,
  addressId,
  {
    addressLine1,
    addressLine2,
    city,
    state,
    country,
    postalCode,
    latitude,
    longitude,
    isDefault,
    addressType,
  }
) => {
  const existingAddress = await prisma.userAddress.findFirst({
    where: {
      id: addressId,
      userId,
    },
  });

  if (!existingAddress) {
    throw createError("Address not found", 404, "ADDRESS_NOT_FOUND");
  }

  const normalizedAddressType =
    addressType !== undefined ? normalizeRole(addressType) : undefined;

  if (normalizedAddressType) {
    validateAddressType(normalizedAddressType);
  }

  const defaultValue = parseBoolean(isDefault);

  if (isDefault !== undefined && defaultValue === undefined) {
    throw createError(
      "isDefault must be true or false",
      400,
      "INVALID_DEFAULT_STATUS"
    );
  }

  return prisma.$transaction(async (tx) => {
    if (defaultValue === true) {
      await tx.userAddress.updateMany({
        where: {
          userId,
        },
        data: {
          isDefault: false,
        },
      });
    }

    return tx.userAddress.update({
      where: {
        id: addressId,
      },
      data: {
        ...(addressLine1 !== undefined
          ? { addressLine1: normalizeString(addressLine1) }
          : {}),
        ...(addressLine2 !== undefined
          ? { addressLine2: normalizeString(addressLine2) }
          : {}),
        ...(city !== undefined ? { city: normalizeString(city) } : {}),
        ...(state !== undefined ? { state: normalizeString(state) } : {}),
        ...(country !== undefined ? { country: normalizeString(country) } : {}),
        ...(postalCode !== undefined
          ? { postalCode: normalizeString(postalCode) }
          : {}),
        ...(latitude !== undefined ? { latitude: normalizeNumber(latitude) } : {}),
        ...(longitude !== undefined
          ? { longitude: normalizeNumber(longitude) }
          : {}),
        ...(isDefault !== undefined ? { isDefault: defaultValue } : {}),
        ...(normalizedAddressType !== undefined
          ? { addressType: normalizedAddressType }
          : {}),
      },
    });
  });
};

const deleteMyAddress = async (userId, addressId) => {
  const existingAddress = await prisma.userAddress.findFirst({
    where: {
      id: addressId,
      userId,
    },
  });

  if (!existingAddress) {
    throw createError("Address not found", 404, "ADDRESS_NOT_FOUND");
  }

  await prisma.userAddress.delete({
    where: {
      id: addressId,
    },
  });

  return {
    message: "Address deleted successfully",
  };
};

module.exports = {
  createUser,
  loginUser,
  refreshAccessToken,

  getAllUsers,
  getUserById,
  updateUser,
  updateUserStatus,
  changeUserPassword,
  deleteUser,

  getMyProfile,
  updateMyProfile,
  changeMyPassword,

  getMyAddresses,
  createMyAddress,
  updateMyAddress,
  deleteMyAddress,
};
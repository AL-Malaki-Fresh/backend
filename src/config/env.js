// almalaki-backend/src/config/env.js

require("dotenv").config();

const requiredEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const env = {
  port: Number(process.env.PORT) || 5001,
  nodeEnv: process.env.NODE_ENV || "development",

  // Database URL - for Prisma 7. No insecure fallback: refuse to boot without
  // a real connection string rather than silently pointing at a default DB.
  databaseUrl: requiredEnv("DATABASE_URL"),

  jwtAccessSecret: requiredEnv("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: requiredEnv("JWT_REFRESH_SECRET"),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",

  adminFrontendUrl: process.env.ADMIN_FRONTEND_URL || "http://localhost:5173",

  // Cloudinary (product/category image storage — replaces local disk, see
  // upload.middleware.js). Deliberately NOT run through requiredEnv(): if
  // these are missing the app still boots and every other route still
  // works, only the image-upload endpoint returns a clear 500 instead of
  // silently falling back to ephemeral local disk.
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || "",
};

module.exports = env;
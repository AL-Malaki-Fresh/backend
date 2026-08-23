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

  // Database URL - for Prisma 7
  databaseUrl: process.env.DATABASE_URL || "postgresql://postgres:password@postgres:5432/almalaki",

  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || requiredEnv("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || requiredEnv("JWT_REFRESH_SECRET"),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",

  adminFrontendUrl: process.env.ADMIN_FRONTEND_URL || "http://localhost:5173",
};

module.exports = env;
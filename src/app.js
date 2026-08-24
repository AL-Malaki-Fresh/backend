// src/app.js

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser"); // ✅ ADD THIS
const path = require("path"); // ✅ ADD THIS

const env = require("./config/env");
const routes = require("./routes");
const errorMiddleware = require("./middlewares/error.middleware");

const app = express();

// ✅ FIX: CORS configuration
// Base allowlist for local/dev use, plus whatever ADMIN_FRONTEND_URL is set to
// (e.g. your deployed dashboard URL on Render) and any extra comma-separated
// origins in CORS_EXTRA_ORIGINS.
const allowedOrigins = [
  'http://localhost:5173',     // Vite dev server
  'http://127.0.0.1:5173',
  'http://localhost:3000',     // React dev server
  'http://127.0.0.1:3000',
  'http://localhost:5001',     // Backend itself
  'http://10.0.2.2:5001',      // Android emulator
  env.adminFrontendUrl,
  ...(process.env.CORS_EXTRA_ORIGINS
    ? process.env.CORS_EXTRA_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : []),
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      // Reject anything not on the allowlist instead of silently allowing it
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Cookie parser middleware
app.use(cookieParser());

// ✅ Root route
app.get("/", (req, res) => {
  res.json({
    message: "Al Malaki Fresh API is running",
  });
});

// ✅ Serve static files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// ✅ Cache control middleware
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// ✅ API routes
app.use("/api", routes);

// ✅ Error middleware (should be last)
app.use(errorMiddleware);

module.exports = app;
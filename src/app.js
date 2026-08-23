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
const allowedOrigins = [
  'http://localhost:5173',     // Vite dev server
  'http://127.0.0.1:5173',
  'http://localhost:3000',     // React dev server
  'http://127.0.0.1:3000',
  'http://localhost:5001',     // Backend itself
  'http://192.168.0.57:5001',  // Your network IP
  'http://47.78.60.10:5001',   // Your current IP
  'http://10.0.2.2:5001',      // Android emulator
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      
      // Check if origin is allowed
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        // For development, allow all origins
        callback(null, true);
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
// almalaki-backend/src/server.js

const app = require("./app");
const env = require("./config/env");
const prisma = require("./config/prisma");
const { validateTapConfiguration } = require("./services/tap.service");

const startServer = async () => {
  try {
    // Warn (don't block boot) if Tap isn't configured yet. The rest of the
    // app — products, orders, users, admin — doesn't depend on Tap, so a
    // missing/incomplete payment gateway config shouldn't take the whole
    // backend down. validateTapConfiguration() still runs (and still
    // throws) at the moment an actual payment is attempted, in
    // tap.service.js — that's where it actually matters.
    try {
      validateTapConfiguration();
      console.log("✅ Tap payment configuration looks valid");
    } catch (tapConfigError) {
      console.warn(
        "⚠️  Tap payment is not fully configured yet — checkout will fail until it is:",
        tapConfigError.message
      );
    }

    await prisma.$connect();
    console.log("✅ Database connected successfully");

    const PORT = env.port || 5001;

    // ✅ For Docker - bind to all interfaces
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
      console.log(`📱 Android Emulator: http://10.0.2.2:${PORT}`);
      console.log(`📱 iOS Simulator: http://192.168.0.57:${PORT}`);
      console.log(`🐳 Docker Container: http://0.0.0.0:${PORT}`);
      console.log(`📦 Environment: ${env.nodeEnv}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
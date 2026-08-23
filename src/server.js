// almalaki-backend/src/server.js

const app = require("./app");
const env = require("./config/env");
const prisma = require("./config/prisma");

const startServer = async () => {
  try {
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
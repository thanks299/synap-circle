import "dotenv/config";

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import swaggerUi from "swagger-ui-express";
import mongoSanitize from "express-mongo-sanitize";
import { swaggerSpec } from "./src/config/swagger.js";
import authRoutes from "./src/routes/auth.js";
import contactRoutes from "./src/routes/contacts.js";
import emergencyRoutes from "./src/routes/emergency.js";
import sosRoutes from "./src/routes/sos.js";
import { errorHandler } from "./src/middlewares/errorHandler.js";
import { globalLimiter } from "./src/middlewares/rateLimiter.js";
import { logger } from "./src/utils/logger.js";

const app = express();

// Connect to MongoDB function
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info("MongoDB connected successfully");
    console.log("✅ MongoDB connected successfully");
    return true;
  } catch (err) {
    logger.error("MongoDB connection error:", err);
    console.error("❌ MongoDB connection error:", err);
    return false;
  }
};

// Applying global middleware
app.use(helmet());
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://synap-circle.onrender.com"]
        : "*",
    credentials: true,
  }),
);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(mongoSanitize());

// SWAGGER DOCUMENTATION
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #ff4444 }
      .swagger-ui .info .title small { font-size: 12px }
    `,
    customSiteTitle: "SafeWalk Campus API Documentation",
  }),
);

// Global rate limiter
app.use("/api", globalLimiter);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    mongodb:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/emergency", emergencyRoutes);
app.use("/api/sos", sosRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Global error handler
app.use(errorHandler);

let server;

// Start server
const startServer = async () => {
  try {
    const dbConnected = await connectDB();
    if (!dbConnected) {
      console.error("❌ Database connection failed. Exiting...");
      process.exit(1);
    }

    const PORT = process.env.PORT || 5000;
    server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Environment: ${process.env.NODE_ENV}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
      console.log(
        `📊 MongoDB Status: ${mongoose.connection.readyState === 1 ? "Connected ✅" : "Disconnected ❌"}`,
      );
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Rejection:", err);
  console.error("❌ Unhandled Rejection:", err);
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception:", err);
  console.error("❌ Uncaught Exception:", err);
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    console.log(
      `🛑 ${signal} received again — shutdown already in progress, ignoring.`,
    );
    return;
  }
  isShuttingDown = true;

  console.log(`🛑 ${signal} received. Shutting down gracefully...`);
  logger.info(`${signal} received. Shutting down gracefully...`);

  const shutdownTimeout = setTimeout(() => {
    console.error("⏱️  Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
  shutdownTimeout.unref();

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      console.log("🔌 HTTP server closed.");
    }

    await mongoose.connection.close();
    console.log("📊 MongoDB connection closed.");

    clearTimeout(shutdownTimeout);
    process.exit(0);
  } catch (err) {
    logger.error("Error during shutdown:", err);
    console.error("❌ Error during shutdown:", err);
    process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

if (process.env.NODE_ENV !== "test") {
  await startServer();
}

export default app;

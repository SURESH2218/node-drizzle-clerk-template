import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { handleErrors, notFound } from "./middlewares/errorHandler";
import { handleClerkWebhook } from "./controllers/webhook.controller";
import * as consumerService from "./services/event.consumer";
import * as producerService from "./services/event.producer";
import * as redisService from "./services/redis.service";
import { initializeKafkaTopics } from "./config/kafka.config";
import * as cacheService from "./services/cache.service";
import healthRoutes from "./routes/health.routes";
import * as monitoringService from "./services/monitoring.service";
import viewStateRoutes from "./routes/view_state.routes";
import positionTrackingRoutes from "./routes/position_tracking.routes";
import prefetchRoutes from "./routes/prefetch.routes";
import feedAnalyticsRoutes from "./routes/feed.analytics.routes";
import feedOptimizationRoutes from "./routes/feed.optimization.routes";

export const initializeServices = async () => {
  // Initialize Kafka topics
  await initializeKafkaTopics();

  // Initialize services
  await redisService.ping();
  await producerService.initialize();
  await consumerService.initialize("news-feed-group");
  await consumerService.startConsumer();

  // Initialize cache management
  cacheService.initializeCacheManagement();

  // Start metrics cleanup job
  setInterval(async () => {
    await monitoringService.cleanup();
  }, 24 * 60 * 60 * 1000); // Daily cleanup

  // Handle graceful shutdown
  process.on("SIGTERM", async () => {
    await producerService.shutdown();
    await consumerService.shutdown();
    process.exit(0);
  });
};

const app = express();

app.post(
  "/api/webhooks/clerk",
  express.raw({ type: "application/json" }),
  handleClerkWebhook
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(cookieParser());

// Routes
import authRoutes from "./routes/auth.routes";
import imageRoutes from "./routes/image.routes";
import specializationRoutes from "./routes/specialization.routes";
import postRoutes from "./routes/post.routes";
import followRoutes from "./routes/follow.routes";
import feedRoutes from "./routes/feed.routes";

app.use("/api", authRoutes);
app.use("/image", imageRoutes);
app.use("/api/specializations", specializationRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/follow", followRoutes);
app.use("/api/feed", feedRoutes);
app.use("/health", healthRoutes);
app.use("/api/view-states", viewStateRoutes);
app.use("/api/feed-position", positionTrackingRoutes);
app.use("/api/prefetch", prefetchRoutes);
app.use("/api/feed-analytics", feedAnalyticsRoutes);
app.use("/api/feed-optimization", feedOptimizationRoutes);

app.get("/", (req: Request, res: Response): void => {
  res.status(200).json({
    message: "Welcome to drugboard.ai API...",
  });
});

app.use(notFound);
app.use(handleErrors);

export default app;

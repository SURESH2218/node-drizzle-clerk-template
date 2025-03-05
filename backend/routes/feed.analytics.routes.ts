import express from "express";
import { verifyAuth } from "../middlewares/auth.middleware";
import * as feedAnalyticsController from "../controllers/feed.analytics.controller";

const router = express.Router();

// Apply auth middleware to all routes
router.use(verifyAuth);

// Track feed impression
router.post("/impression", feedAnalyticsController.trackImpression);

// Track feed view
router.post("/view", feedAnalyticsController.trackView);

// Track scroll depth
router.post("/scroll", feedAnalyticsController.trackScrollDepth);

// Track feed refresh
router.post("/refresh", feedAnalyticsController.trackRefresh);

// Track prefetch hit/miss
router.post("/prefetch-hit", feedAnalyticsController.trackPrefetchHit);

// Get feed metrics
router.get("/metrics", feedAnalyticsController.getFeedMetrics);

// Get content type metrics
router.get("/content-metrics", feedAnalyticsController.getContentTypeMetrics);

// Cleanup analytics
router.delete("/cleanup", feedAnalyticsController.cleanupAnalytics);

export default router;

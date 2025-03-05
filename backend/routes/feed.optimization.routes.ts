import express from "express";
import { verifyAuth } from "../middlewares/auth.middleware";
import * as feedOptimizationController from "../controllers/feed.optimization.controller";

const router = express.Router();

// Apply auth middleware to all routes
router.use(verifyAuth);

// Get optimized content mix
router.post("/content", feedOptimizationController.getOptimizedContent);

// Get optimal refresh interval
router.get("/refresh-interval", feedOptimizationController.getRefreshInterval);

// Get optimal prefetch threshold
router.get(
  "/prefetch-threshold",
  feedOptimizationController.getPrefetchThreshold
);

export default router;

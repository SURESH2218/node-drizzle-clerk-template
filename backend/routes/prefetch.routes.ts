import express from "express";
import { verifyAuth } from "../middlewares/auth.middleware";
import * as prefetchController from "../controllers/prefetch.controller";

const router = express.Router();

// Apply auth middleware to all routes
router.use(verifyAuth);

// Initialize prefetch state
router.post("/init", prefetchController.initPrefetch);

// Get prefetch state
router.get("/state", prefetchController.getPrefetchState);

// Trigger next batch prefetch
router.post("/trigger", prefetchController.triggerPrefetch);

// Prefetch specialization content
router.post("/specialization", prefetchController.prefetchSpecialization);

// Prefetch trending content
router.post("/trending", prefetchController.prefetchTrending);

// Cleanup prefetched content
router.delete("/cleanup", prefetchController.cleanupPrefetch);

export default router;
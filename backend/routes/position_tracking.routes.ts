import express from "express";
import { verifyAuth } from "../middlewares/auth.middleware";
import * as positionTrackingController from "../controllers/position_tracking.controller";

const router = express.Router();

// Apply auth middleware to all routes
router.use(verifyAuth);

// Save feed position
router.post("/", positionTrackingController.saveFeedPosition);

// Get feed position
router.get("/", positionTrackingController.getFeedPosition);

// Clear feed position
router.delete("/", positionTrackingController.clearFeedPosition);

// Get posts around position
router.get("/posts", positionTrackingController.getPostsAroundPosition);

// Update feed position
router.patch("/", positionTrackingController.updateFeedPosition);

export default router;

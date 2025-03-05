import express from "express";
import { verifyAuth } from "../middlewares/auth.middleware";
import * as viewStateController from "../controllers/view_state.controller";

const router = express.Router();

// Apply auth middleware to all routes
router.use(verifyAuth);

// Track post view
router.post("/:postId/view", viewStateController.trackView);

// Get view state
router.get("/:postId", viewStateController.getViewState);

// Track interaction
router.post("/:postId/interaction", viewStateController.trackInteraction);

export default router;

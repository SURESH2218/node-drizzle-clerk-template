import { Request, Response } from "express";
import * as positionTrackingService from "../services/position_tracking.service";
import asyncHandler from "../utils/asynHandler";
import APISuccessResponse from "../lib/APISuccessResponse";
import APIErrorResponse from "../lib/APIErrorResponse";

// Save feed position
export const saveFeedPosition = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { lastPostId, scrollOffset, deviceType, viewportHeight } = req.body;

    await positionTrackingService.saveFeedPosition(userId, {
      lastPostId,
      scrollOffset,
      deviceType,
      viewportHeight,
      timestamp: Date.now(),
    });

    return res.status(200).json(
      new APISuccessResponse(200, {
        message: "Feed position saved successfully",
      })
    );
  }
);

// Get feed position
export const getFeedPosition = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const position = await positionTrackingService.getFeedPosition(userId);

    if (!position) {
      return res
        .status(404)
        .json(new APIErrorResponse(404, "Feed position not found"));
    }

    return res.status(200).json(
      new APISuccessResponse(200, {
        position,
      })
    );
  }
);

// Clear feed position
export const clearFeedPosition = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    await positionTrackingService.clearFeedPosition(userId);

    return res.status(200).json(
      new APISuccessResponse(200, {
        message: "Feed position cleared successfully",
      })
    );
  }
);

// Get posts around position
export const getPostsAroundPosition = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { count } = req.query;

    const position = await positionTrackingService.getFeedPosition(userId);
    if (!position) {
      return res
        .status(404)
        .json(new APIErrorResponse(404, "Feed position not found"));
    }

    const posts = await positionTrackingService.getPostsAroundPosition(
      userId,
      position,
      count ? parseInt(count as string) : undefined
    );

    return res.status(200).json(
      new APISuccessResponse(200, {
        posts,
        position,
      })
    );
  }
);

// Update feed position
export const updateFeedPosition = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const updates = req.body;

    await positionTrackingService.updateFeedPosition(userId, updates);

    return res.status(200).json(
      new APISuccessResponse(200, {
        message: "Feed position updated successfully",
      })
    );
  }
);

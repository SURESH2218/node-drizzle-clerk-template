import { Request, Response } from "express";
import * as feedAnalyticsService from "../services/feed.analytics.service";
import asyncHandler from "../utils/asynHandler";
import APISuccessResponse from "../lib/APISuccessResponse";

// Track feed impression
export const trackImpression = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { feedType } = req.body;

    await feedAnalyticsService.trackFeedImpression(userId, feedType);

    return res.status(200).json(
      new APISuccessResponse(200, {
        message: "Feed impression tracked successfully",
      })
    );
  }
);

// Track feed view
export const trackView = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { feedType, viewDuration } = req.body;

  await feedAnalyticsService.trackFeedView(userId, feedType, viewDuration);

  return res.status(200).json(
    new APISuccessResponse(200, {
      message: "Feed view tracked successfully",
    })
  );
});

// Track scroll depth
export const trackScrollDepth = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { feedType, scrollDepth } = req.body;

    await feedAnalyticsService.trackScrollDepth(userId, feedType, scrollDepth);

    return res.status(200).json(
      new APISuccessResponse(200, {
        message: "Scroll depth tracked successfully",
      })
    );
  }
);

// Track feed refresh
export const trackRefresh = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { feedType } = req.body;

    await feedAnalyticsService.trackFeedRefresh(userId, feedType);

    return res.status(200).json(
      new APISuccessResponse(200, {
        message: "Feed refresh tracked successfully",
      })
    );
  }
);

// Track prefetch hit/miss
export const trackPrefetchHit = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { feedType, isHit } = req.body;

    await feedAnalyticsService.trackPrefetchHit(userId, feedType, isHit);

    return res.status(200).json(
      new APISuccessResponse(200, {
        message: "Prefetch hit tracked successfully",
      })
    );
  }
);

// Get feed metrics
export const getFeedMetrics = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { feedType } = req.query;

    const metrics = await feedAnalyticsService.getFeedMetrics(
      userId,
      feedType as string
    );

    return res.status(200).json(
      new APISuccessResponse(200, {
        metrics,
      })
    );
  }
);

// Get content type metrics
export const getContentTypeMetrics = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { feedType } = req.query;

    const metrics = await feedAnalyticsService.getContentTypeMetrics(
      userId,
      feedType as string
    );

    return res.status(200).json(
      new APISuccessResponse(200, {
        metrics,
      })
    );
  }
);

// Cleanup analytics
export const cleanupAnalytics = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;

    await feedAnalyticsService.cleanupAnalytics(userId);

    return res.status(200).json(
      new APISuccessResponse(200, {
        message: "Analytics cleaned up successfully",
      })
    );
  }
);

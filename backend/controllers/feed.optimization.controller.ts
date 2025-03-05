import { Request, Response } from "express";
import * as feedOptimizationService from "../services/feed.optimization.service";
import asyncHandler from "../utils/asynHandler";
import APISuccessResponse from "../lib/APISuccessResponse";

// Get optimized content mix
export const getOptimizedContent = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { weights } = req.body;

    const optimizedContent = await feedOptimizationService.optimizeContentMix(
      userId,
      weights
    );

    return res.status(200).json(
      new APISuccessResponse(200, {
        content: optimizedContent,
      })
    );
  }
);

// Get optimal refresh interval
export const getRefreshInterval = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const interval = await feedOptimizationService.getOptimalRefreshInterval(
      userId
    );

    return res.status(200).json(
      new APISuccessResponse(200, {
        interval,
      })
    );
  }
);

// Get optimal prefetch threshold
export const getPrefetchThreshold = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const threshold = await feedOptimizationService.getOptimalPrefetchThreshold(
      userId
    );

    return res.status(200).json(
      new APISuccessResponse(200, {
        threshold,
      })
    );
  }
);

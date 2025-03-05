import { Request, Response } from "express";
import * as prefetchService from "../services/prefetch.service";
import asyncHandler from "../utils/asynHandler";
import APISuccessResponse from "../lib/APISuccessResponse";
import APIErrorResponse from "../lib/APIErrorResponse";

// Initialize prefetch state
export const initPrefetch = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { currentPage } = req.body;

    await prefetchService.initPrefetchState(userId, currentPage);

    return res.status(200).json(
      new APISuccessResponse(200, {
        message: "Prefetch state initialized successfully",
      })
    );
  }
);

// Get prefetch state
export const getPrefetchState = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const state = await prefetchService.getPrefetchState(userId);

    if (!state) {
      return res
        .status(404)
        .json(new APIErrorResponse(404, "Prefetch state not found"));
    }

    return res.status(200).json(
      new APISuccessResponse(200, {
        state,
      })
    );
  }
);

// Trigger next batch prefetch
export const triggerPrefetch = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { scrollPosition, totalHeight } = req.body;

    await prefetchService.prefetchNextBatch(
      userId,
      scrollPosition,
      totalHeight
    );

    return res.status(200).json(
      new APISuccessResponse(200, {
        message: "Content prefetched successfully",
      })
    );
  }
);

// Prefetch specialization content
export const prefetchSpecialization = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { specializationIds } = req.body;

    if (!Array.isArray(specializationIds)) {
      throw new APIErrorResponse(400, "specializationIds must be an array");
    }

    await prefetchService.prefetchSpecializationContent(
      userId,
      specializationIds
    );

    return res.status(200).json(
      new APISuccessResponse(200, {
        message: "Specialization content prefetched successfully",
      })
    );
  }
);

// Prefetch trending content
export const prefetchTrending = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    await prefetchService.prefetchTrendingContent(userId);

    return res.status(200).json(
      new APISuccessResponse(200, {
        message: "Trending content prefetched successfully",
      })
    );
  }
);

// Cleanup prefetched content
export const cleanupPrefetch = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    await prefetchService.cleanupPrefetchedContent(userId);

    return res.status(200).json(
      new APISuccessResponse(200, {
        message: "Prefetched content cleaned up successfully",
      })
    );
  }
);

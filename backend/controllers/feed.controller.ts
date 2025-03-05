// controllers/feed.controller.ts
import { Request, Response } from "express";
import * as feedService from "../services/feed.service";
import asyncHandler from "../utils/asynHandler";
import APISuccessResponse from "../lib/APISuccessResponse";
import APIErrorResponse from "../lib/APIErrorResponse";

export const getFeed = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const page = Math.max(1, Number(req.query.page) || 1); // Ensure page is at least 1
  const { lastUpdate } = req.query;

  const feed = await feedService.generateFeed(
    userId,
    page,
    lastUpdate as string
  );

  return res.status(200).json(
    new APISuccessResponse(200, {
      posts: feed.posts,
      lastUpdate: feed.lastUpdate,
      hasMore: feed.hasMore,
      totalItems: feed.totalItems,
      currentPage: page,
    })
  );
});

export const getPollingInterval = asyncHandler(
  async (req: Request, res: Response) => {
    const { isActive, isTabFocused } = req.query;

    let interval: number;

    if (isActive === "true" && isTabFocused === "true") {
      interval = 3 * 60 * 1000; // 2 minutes for active users
    } else if (isActive === "true") {
      interval = 5 * 60 * 1000; // 5 minutes for semi-active
    } else {
      interval = 15 * 60 * 1000; // 15 minutes for inactive
    }

    return res
      .status(200)
      .json(new APISuccessResponse(200, { pollingInterval: interval }));
  }
);

export const getDifferentialUpdates = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { lastUpdate } = req.query;

    if (!lastUpdate) {
      throw new APIErrorResponse(400, "lastUpdate timestamp is required");
    }

    const updates = await feedService.getDifferentialUpdates(
      userId,
      lastUpdate as string
    );

    return res.status(200).json(
      new APISuccessResponse(200, {
        posts: updates.posts,
        lastUpdate: updates.lastUpdate,
      })
    );
  }
);

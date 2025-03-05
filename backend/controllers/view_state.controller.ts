import { Request, Response } from "express";
import * as viewStateService from "../services/view_state.service";
import asyncHandler from "../utils/asynHandler";
import APISuccessResponse from "../lib/APISuccessResponse";
import APIErrorResponse from "../lib/APIErrorResponse";

// Track post view
export const trackView = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { postId } = req.params;
  const { scrollPosition, viewportHeight, deviceType, viewDuration } = req.body;

  const viewState = await viewStateService.trackPostView(
    userId,
    parseInt(postId),
    {
      scrollPosition,
      viewportHeight,
      deviceType,
      viewDuration,
    }
  );

  return res.status(200).json(
    new APISuccessResponse(200, {
      viewState,
    })
  );
});

// Get view state
export const getViewState = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { postId } = req.params;

    const viewState = await viewStateService.getViewState(
      userId,
      parseInt(postId)
    );

    if (!viewState) {
      return res
        .status(404)
        .json(new APIErrorResponse(404, "View state not found"));
    }

    return res.status(200).json(
      new APISuccessResponse(200, {
        viewState,
      })
    );
  }
);

// Track interaction
export const trackInteraction = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { postId } = req.params;
    const { interactionType } = req.body;

    if (!["like", "comment", "share", "save"].includes(interactionType)) {
      throw new APIErrorResponse(400, "Invalid interaction type");
    }

    const viewState = await viewStateService.trackInteraction(
      userId,
      parseInt(postId),
      interactionType
    );

    return res.status(200).json(
      new APISuccessResponse(200, {
        viewState,
      })
    );
  }
);

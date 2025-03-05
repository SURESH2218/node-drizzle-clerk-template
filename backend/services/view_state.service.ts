import { db } from "../db/db";
import {
  viewStates,
  InteractionEvent,
  ViewState,
} from "../models/schema/view_state.schema";
import * as redisService from "./redis.service";
import { eq, and } from "drizzle-orm";
import APIErrorResponse from "../lib/APIErrorResponse";

const VIEW_STATE_CACHE_PREFIX = "view_state:";
const VIEW_STATE_TTL = 60 * 60 * 24; // 24 hours

// Create or update view state
export const trackPostView = async (
  userId: number,
  postId: number,
  data: {
    scrollPosition?: number;
    viewportHeight?: number;
    deviceType?: string;
    viewDuration?: number;
  }
): Promise<ViewState> => {
  try {
    const now = new Date();
    const cacheKey = `${VIEW_STATE_CACHE_PREFIX}${userId}:${postId}`;

    // Try to get existing view state from cache
    let viewState = await redisService.getViewState(cacheKey);

    if (!viewState) {
      // Check database if not in cache
      viewState = await db.query.viewStates.findFirst({
        where: and(
          eq(viewStates.userId, userId),
          eq(viewStates.postId, postId)
        ),
      });
    }

    const interaction: InteractionEvent = {
      type: "view",
      timestamp: now,
      data: {
        scrollPosition: data.scrollPosition,
        viewDuration: data.viewDuration,
        deviceType: data.deviceType,
      },
    };

    if (viewState) {
      // Update existing view state
      const updatedViewState = await updateViewState(
        viewState,
        data,
        interaction
      );
      await cacheViewState(cacheKey, updatedViewState);
      return updatedViewState;
    } else {
      // Create new view state
      const newViewState = await createViewState(
        userId,
        postId,
        data,
        interaction
      );
      await cacheViewState(cacheKey, newViewState);
      return newViewState;
    }
  } catch (error) {
    console.error("Error tracking post view:", error);
    throw new APIErrorResponse(500, "Failed to track post view");
  }
};

// Create new view state
const createViewState = async (
  userId: number,
  postId: number,
  data: {
    scrollPosition?: number;
    viewportHeight?: number;
    deviceType?: string;
    viewDuration?: number;
  },
  interaction: InteractionEvent
): Promise<ViewState> => {
  const now = new Date();

  return (
    await db
      .insert(viewStates)
      .values({
        userId,
        postId,
        viewStatus: "impression",
        firstViewedAt: now,
        lastViewedAt: now,
        totalViewDuration: data.viewDuration || 0,
        lastScrollPosition: data.scrollPosition || 0,
        maxScrollPosition: data.scrollPosition || 0,
        deviceType: data.deviceType,
        viewportHeight: data.viewportHeight,
        interactionHistory: [interaction],
        createdAt: now,
        updatedAt: now,
      })
      .returning()
  )[0];
};

// Update existing view state
const updateViewState = async (
  currentState: ViewState,
  data: {
    scrollPosition?: number;
    viewportHeight?: number;
    deviceType?: string;
    viewDuration?: number;
  },
  interaction: InteractionEvent
): Promise<ViewState> => {
  const now = new Date();
  const maxScroll = Math.max(
    currentState.maxScrollPosition ?? 0,
    data.scrollPosition || 0
  );

  // Calculate read percentage based on scroll position
  const readPercentage = data.viewportHeight
    ? Math.min(100, Math.round((maxScroll / data.viewportHeight) * 100))
    : currentState.readPercentage;

  // Determine view status
  let viewStatus = currentState.viewStatus;
  if ((readPercentage ?? 0) >= 80) {
    viewStatus = "complete_view";
  } else if ((readPercentage ?? 0) >= 30) {
    viewStatus = "partial_view";
  }

  const updatedState = await db
    .update(viewStates)
    .set({
      lastViewedAt: now,
      totalViewDuration:
        (currentState.totalViewDuration || 0) + (data.viewDuration || 0),
      lastScrollPosition:
        data.scrollPosition || currentState.lastScrollPosition,
      maxScrollPosition: maxScroll,
      readPercentage,
      viewStatus,
      interactionHistory: [
        ...((currentState.interactionHistory as InteractionEvent[]) || []),
        interaction,
      ],
      updatedAt: now,
    })
    .where(
      and(
        eq(viewStates.userId, currentState.userId),
        eq(viewStates.postId, currentState.postId)
      )
    )
    .returning();

  return updatedState[0];
};

// Cache view state in Redis
const cacheViewState = async (
  key: string,
  viewState: ViewState
): Promise<void> => {
  await redisService.setViewState(key, viewState, VIEW_STATE_TTL);
};

// Get view state
export const getViewState = async (
  userId: number,
  postId: number
): Promise<ViewState | null> => {
  try {
    const cacheKey = `${VIEW_STATE_CACHE_PREFIX}${userId}:${postId}`;

    // Try cache first
    const cachedState = await redisService.getViewState(cacheKey);
    if (cachedState) {
      return cachedState;
    }

    // Fallback to database
    const viewState = await db.query.viewStates.findFirst({
      where: and(eq(viewStates.userId, userId), eq(viewStates.postId, postId)),
    });

    if (viewState) {
      await cacheViewState(cacheKey, viewState);
    }

    return viewState ?? null;
  } catch (error) {
    console.error("Error getting view state:", error);
    throw new APIErrorResponse(500, "Failed to get view state");
  }
};

// Track interaction (like, comment, share, save)
export const trackInteraction = async (
  userId: number,
  postId: number,
  interactionType: InteractionEvent["type"]
): Promise<ViewState> => {
  try {
    const viewState = await getViewState(userId, postId);
    if (!viewState) {
      throw new APIErrorResponse(404, "View state not found");
    }

    const interaction: InteractionEvent = {
      type: interactionType,
      timestamp: new Date(),
    };

    const updates: Partial<ViewState> = {
      interactionHistory: [
        ...((viewState.interactionHistory as InteractionEvent[]) || []),
        interaction,
      ],
      updatedAt: new Date(),
    };

    // Update specific interaction flags
    switch (interactionType) {
      case "like":
        updates.hasLiked = true;
        break;
      case "comment":
        updates.hasCommented = true;
        break;
      case "share":
        updates.hasShared = true;
        break;
      case "save":
        updates.hasSaved = true;
        break;
    }

    const updatedState = await db
      .update(viewStates)
      .set(updates)
      .where(and(eq(viewStates.userId, userId), eq(viewStates.postId, postId)))
      .returning();

    const cacheKey = `${VIEW_STATE_CACHE_PREFIX}${userId}:${postId}`;
    await cacheViewState(cacheKey, updatedState[0]);

    return updatedState[0];
  } catch (error) {
    console.error("Error tracking interaction:", error);
    throw new APIErrorResponse(500, "Failed to track interaction");
  }
};

export const getViewCount = async (
  userId: number,
  postId: number
): Promise<number> => {
  const viewState = await getViewState(userId, postId);
  if (!viewState) return 0;

  // Count "view" type interactions
  return (viewState.interactionHistory as InteractionEvent[]).filter(
    (interaction) => interaction.type === "view"
  ).length;
};

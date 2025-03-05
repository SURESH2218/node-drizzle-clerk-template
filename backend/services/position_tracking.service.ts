import * as redisService from "./redis.service";
import APIErrorResponse from "../lib/APIErrorResponse";

const POSITION_KEY_PREFIX = "feed:position:";
const POSITION_TTL = 60 * 60 * 24; // 24 hours

interface FeedPosition {
  userId: number;
  lastPostId: number;
  scrollOffset: number;
  timestamp: number;
  deviceType: string;
  viewportHeight: number;
}

// Save feed position
export const saveFeedPosition = async (
  userId: number,
  position: Omit<FeedPosition, "userId">
): Promise<void> => {
  try {
    const key = `${POSITION_KEY_PREFIX}${userId}`;
    const feedPosition: FeedPosition = {
      userId,
      ...position,
    };

    await redisService.setWithExpiry(key, feedPosition, POSITION_TTL);
  } catch (error) {
    console.error("Error saving feed position:", error);
    throw new APIErrorResponse(500, "Failed to save feed position");
  }
};

// Get feed position
export const getFeedPosition = async (
  userId: number
): Promise<FeedPosition | null> => {
  try {
    const key = `${POSITION_KEY_PREFIX}${userId}`;
    return await redisService.get(key);
  } catch (error) {
    console.error("Error getting feed position:", error);
    throw new APIErrorResponse(500, "Failed to get feed position");
  }
};

// Clear feed position
export const clearFeedPosition = async (userId: number): Promise<void> => {
  try {
    const key = `${POSITION_KEY_PREFIX}${userId}`;
    await redisService.del(key);
  } catch (error) {
    console.error("Error clearing feed position:", error);
    throw new APIErrorResponse(500, "Failed to clear feed position");
  }
};

// Get posts around position
export const getPostsAroundPosition = async (
  userId: number,
  position: FeedPosition,
  count: number = 10
): Promise<any[]> => {
  try {
    const cachedFeed = await redisService.getFeed(userId);
    if (!cachedFeed.length) return [];

    // Find the index of the last viewed post
    const lastPostIndex = cachedFeed.findIndex(
      (post) => JSON.parse(post).id === position.lastPostId
    );

    if (lastPostIndex === -1) return [];

    // Calculate start and end indices
    const halfCount = Math.floor(count / 2);
    const start = Math.max(0, lastPostIndex - halfCount);
    const end = Math.min(cachedFeed.length, lastPostIndex + halfCount);

    // Get posts around the position
    return cachedFeed.slice(start, end).map((post) => JSON.parse(post));
  } catch (error) {
    console.error("Error getting posts around position:", error);
    throw new APIErrorResponse(500, "Failed to get posts around position");
  }
};

// Update feed position
export const updateFeedPosition = async (
  userId: number,
  updates: Partial<Omit<FeedPosition, "userId">>
): Promise<void> => {
  try {
    const key = `${POSITION_KEY_PREFIX}${userId}`;
    const currentPosition = await getFeedPosition(userId);

    if (!currentPosition) {
      throw new APIErrorResponse(404, "Feed position not found");
    }

    const updatedPosition: FeedPosition = {
      ...currentPosition,
      ...updates,
      userId,
      timestamp: Date.now(),
    };

    await redisService.setWithExpiry(key, updatedPosition, POSITION_TTL);
  } catch (error) {
    console.error("Error updating feed position:", error);
    throw new APIErrorResponse(500, "Failed to update feed position");
  }
};

// Get multiple user positions
export const getBatchFeedPositions = async (
  userIds: number[]
): Promise<(FeedPosition | null)[]> => {
  try {
    const keys = userIds.map((id) => `${POSITION_KEY_PREFIX}${id}`);
    return await redisService.mget(keys);
  } catch (error) {
    console.error("Error getting batch feed positions:", error);
    throw new APIErrorResponse(500, "Failed to get batch feed positions");
  }
};

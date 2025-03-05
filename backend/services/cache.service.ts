import * as redisService from "./redis.service";
import * as feedService from "./feed.service";
import { db } from "../db/db";
import { users, follows } from "../models/schema";
import { eq, gte, sql } from "drizzle-orm";
import { POPULAR_USER_THRESHOLD } from "../types/kafka.types";

const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const FEED_WARM_INTERVAL = 15 * 60 * 1000; // 15 minutes

export const initializeCacheManagement = () => {
  // Start cache cleanup job
  setInterval(async () => {
    await redisService.cleanupStaleFeeds();
  }, CACHE_CLEANUP_INTERVAL);

  // Start feed warming job
  setInterval(async () => {
    await warmPopularUserFeeds();
  }, FEED_WARM_INTERVAL);
};

const warmPopularUserFeeds = async () => {
  try {
    // Get users with high follower count
    const popularUsers = await db
      .select({
        id: users.id,
        followerCount: sql<number>`count(${follows.followerId})::int`,
      })
      .from(users)
      .innerJoin(follows, eq(users.id, follows.followingId))
      .groupBy(users.id)
      .having(({ followerCount }) =>
        gte(followerCount, POPULAR_USER_THRESHOLD)
      );

    // Preload their feeds
    await redisService.preloadPopularUserFeeds(popularUsers.map((u) => u.id));

    // For each popular user, warm up their followers' feeds
    for (const user of popularUsers) {
      const followers = await db
        .select({ id: follows.followerId })
        .from(follows)
        .where(eq(follows.followingId, user.id));

      // Generate fresh feeds for followers
      await Promise.all(
        followers.map(async (follower) => {
          const feed = await feedService.generateFreshFeed(follower.id);
          await redisService.warmUpFeed(follower.id, feed, "high");
        })
      );
    }
  } catch (error) {
    console.error("Error warming popular user feeds:", error);
  }
};

export const warmUserFeed = async (userId: number): Promise<void> => {
  try {
    const feed = await feedService.generateFreshFeed(userId);
    await redisService.warmUpFeed(userId, feed, "high");
  } catch (error) {
    console.error(`Error warming feed for user ${userId}:`, error);
  }
};

export const warmUserFeeds = async (userIds: number[]): Promise<void> => {
  try {
    await Promise.all(
      userIds.map(async (userId) => {
        const accessCount = await redisService.getFeedAccessCount(userId);
        if (accessCount >= redisService.FEED_WARM_THRESHOLD) {
          await warmUserFeed(userId);
        }
      })
    );
  } catch (error) {
    console.error("Error warming user feeds:", error);
  }
};

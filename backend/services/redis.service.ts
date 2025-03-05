// services/redis/redis.service.ts

import redis from "../config/redis.config";
import APIErrorResponse from "../lib/APIErrorResponse";

const FEED_KEY_PREFIX = "feed:";
const POST_KEY_PREFIX = "post:";
const POPULAR_POSTS_KEY = "popular:posts";
const POPULAR_USERS_KEY = "popular:users";
const USER_FOLLOWERS_PREFIX = "followers:";
const FEED_EXPIRY = 60 * 5; // 5 minutes
const POST_EXPIRY = 60 * 60 * 24; // 24 hours
const POPULAR_POSTS_LIMIT = 100;
const POPULAR_USER_THRESHOLD = 1000; // Minimum followers to be considered popular

// Cache Management Constants
const CACHE_BATCH_SIZE = 50;
const CACHE_WARM_TTL = 60 * 30; // 30 minutes
export const FEED_WARM_THRESHOLD = 5; // Number of recent accesses to consider a feed "hot"

interface FeedMetadata {
  posts: any[];
  lastUpdate: string | null; // Allow null for initial state
  totalItems: number;
  hasMore: boolean;
}

// Feed Cache Methods
export const getFeed = async (
  userId: number,
  page: number = 1,
  limit: number = 20
): Promise<string[]> => {
  try {
    const start = (page - 1) * limit;
    const end = start + limit - 1;
    const feedKey = `${FEED_KEY_PREFIX}${userId}`;

    const feed = await redis.lrange(feedKey, start, end);
    return feed.map((item) => {
      try {
        // Try to parse if it's a JSON string
        return typeof item === "string" ? item : JSON.stringify(item);
      } catch {
        // If parsing fails, return as is
        return item;
      }
    });
  } catch (error) {
    console.error("Redis getFeed error:", error);
    throw new APIErrorResponse(500, "Failed to get feed from cache");
  }
};

export const cacheFeed = async (
  userId: number,
  posts: any[]
): Promise<void> => {
  try {
    console.log("Caching feed for user:", userId);
    const feedKey = `${FEED_KEY_PREFIX}${userId}`;
    const pipeline = redis.pipeline();

    // Clear existing feed
    pipeline.del(feedKey);

    // Add all posts
    posts.forEach((post) => {
      // Check if the post is already a string to avoid double serialization
      const postString = typeof post === "string" ? post : JSON.stringify(post);
      pipeline.lpush(feedKey, postString);
    });

    // Set expiry
    pipeline.expire(feedKey, FEED_EXPIRY);

    await pipeline.exec();
  } catch (error) {
    console.error("Redis cacheFeed error:", error);
    throw new APIErrorResponse(500, "Failed to cache feed");
  }
};

export const invalidateFeed = async (userId: number): Promise<void> => {
  try {
    const feedKey = `${FEED_KEY_PREFIX}${userId}`;
    await redis.del(feedKey);
  } catch (error) {
    console.error("Redis invalidateFeed error:", error);
    throw new APIErrorResponse(500, "Failed to invalidate feed cache");
  }
};

export const invalidateFeeds = async (userIds: number[]): Promise<void> => {
  try {
    const pipeline = redis.pipeline();
    userIds.forEach((userId) => {
      const feedKey = `${FEED_KEY_PREFIX}${userId}`;
      pipeline.del(feedKey);
    });
    await pipeline.exec();
  } catch (error) {
    console.error("Redis invalidateFeeds error:", error);
    throw new APIErrorResponse(
      500,
      "Failed to invalidate multiple feed caches"
    );
  }
};

// Post Cache Methods
export const cachePost = async (
  postId: number,
  postData: any
): Promise<void> => {
  try {
    const postKey = `${POST_KEY_PREFIX}${postId}`;
    await redis
      .multi()
      .set(postKey, JSON.stringify(postData))
      .expire(postKey, POST_EXPIRY)
      .exec();
  } catch (error) {
    console.error("Redis cachePost error:", error);
    throw new APIErrorResponse(500, "Failed to cache post");
  }
};

export const getPost = async (postId: number): Promise<any | null> => {
  try {
    const postKey = `${POST_KEY_PREFIX}${postId}`;
    const post = await redis.get(postKey);
    return post ? JSON.parse(post) : null;
  } catch (error) {
    console.error("Redis getPost error:", error);
    throw new APIErrorResponse(500, "Failed to get post from cache");
  }
};

export const invalidatePost = async (postId: number): Promise<void> => {
  try {
    const postKey = `${POST_KEY_PREFIX}${postId}`;
    await redis.del(postKey);
  } catch (error) {
    console.error("Redis invalidatePost error:", error);
    throw new APIErrorResponse(500, "Failed to invalidate post cache");
  }
};

// Health Check
export const ping = async (): Promise<boolean> => {
  try {
    const response = await redis.ping();
    return response === "PONG";
  } catch (error) {
    console.error("Redis ping error:", error);
    return false;
  }
};

// Popular Posts Methods
export const addPopularPost = async (
  postId: number,
  score: number
): Promise<void> => {
  try {
    await redis
      .multi()
      .zadd(POPULAR_POSTS_KEY, score, postId.toString())
      .zremrangebyrank(POPULAR_POSTS_KEY, 0, -POPULAR_POSTS_LIMIT - 1)
      .exec();
  } catch (error) {
    console.error("Redis addPopularPost error:", error);
    throw new APIErrorResponse(500, "Failed to add popular post");
  }
};

export const getPopularPosts = async (
  limit: number = 20
): Promise<string[]> => {
  try {
    return await redis.zrevrange(POPULAR_POSTS_KEY, 0, limit - 1);
  } catch (error) {
    console.error("Redis getPopularPosts error:", error);
    throw new APIErrorResponse(500, "Failed to get popular posts");
  }
};

export const getPopularPostsSince = async (
  timestamp: number,
  limit: number = 20
): Promise<string[]> => {
  try {
    return await redis.zrevrangebyscore(
      POPULAR_POSTS_KEY,
      "+inf",
      timestamp,
      "LIMIT",
      0,
      limit
    );
  } catch (error) {
    console.error("Redis getPopularPostsSince error:", error);
    throw new APIErrorResponse(
      500,
      "Failed to get popular posts since timestamp"
    );
  }
};

// User Followers Methods
export const setUserFollowerCount = async (
  userId: number,
  count: number
): Promise<void> => {
  try {
    if (count >= POPULAR_USER_THRESHOLD) {
      await redis.sadd(POPULAR_USERS_KEY, userId.toString());
    } else {
      await redis.srem(POPULAR_USERS_KEY, userId.toString());
    }
  } catch (error) {
    console.error("Redis setUserFollowerCount error:", error);
    throw new APIErrorResponse(500, "Failed to set user follower count");
  }
};

export const isPopularUser = async (userId: number): Promise<boolean> => {
  try {
    const result = await redis.sismember(POPULAR_USERS_KEY, userId.toString());
    return result === 1;
  } catch (error) {
    console.error("Redis isPopularUser error:", error);
    throw new APIErrorResponse(500, "Failed to check if user is popular");
  }
};

// Cache Warming and Management
export const trackFeedAccess = async (userId: number): Promise<void> => {
  try {
    const accessKey = `${FEED_KEY_PREFIX}${userId}:access`;
    const pipeline = redis.pipeline();

    pipeline.incr(accessKey);
    pipeline.expire(accessKey, CACHE_WARM_TTL);

    await pipeline.exec();
  } catch (error) {
    console.error("Redis trackFeedAccess error:", error);
  }
};

export const getFeedAccessCount = async (userId: number): Promise<number> => {
  try {
    const accessKey = `${FEED_KEY_PREFIX}${userId}:access`;
    const count = await redis.get(accessKey);
    return count ? parseInt(count) : 0;
  } catch (error) {
    console.error("Redis getFeedAccessCount error:", error);
    return 0;
  }
};

export const warmUpFeed = async (
  userId: number,
  posts: any[],
  priority: "high" | "low" = "low"
): Promise<void> => {
  try {
    const timestamp = Date.now();
    const feedKey = `${FEED_KEY_PREFIX}${userId}`;
    const pipeline = redis.pipeline();

    // Set longer expiry for frequently accessed feeds
    const expiry = priority === "high" ? FEED_EXPIRY * 2 : FEED_EXPIRY;

    pipeline.del(feedKey);
    posts.forEach((post) => {
      pipeline.lpush(feedKey, JSON.stringify(post));
    });
    pipeline.expire(feedKey, expiry);

    await pipeline.exec();
  } catch (error) {
    console.error("Redis warmUpFeed error:", error);
  }
};

export const preloadPopularUserFeeds = async (
  userIds: number[]
): Promise<void> => {
  try {
    for (let i = 0; i < userIds.length; i += CACHE_BATCH_SIZE) {
      const batch = userIds.slice(i, i + CACHE_BATCH_SIZE);
      await Promise.all(
        batch.map(async (userId) => {
          const accessCount = await getFeedAccessCount(userId);
          if (accessCount >= FEED_WARM_THRESHOLD) {
            // Signal that this feed should be regenerated with high priority
            await warmUpFeed(userId, [], "high");
          }
        })
      );
    }
  } catch (error) {
    console.error("Redis preloadPopularUserFeeds error:", error);
  }
};

// Cache Cleanup Methods
export const cleanupStaleFeeds = async (): Promise<void> => {
  try {
    const feedPattern = `${FEED_KEY_PREFIX}*`;
    const keys = await redis.keys(feedPattern);

    for (let i = 0; i < keys.length; i += CACHE_BATCH_SIZE) {
      const batch = keys.slice(i, i + CACHE_BATCH_SIZE);
      const pipeline = redis.pipeline();

      batch.forEach((key) => {
        pipeline.ttl(key);
      });

      const results = await pipeline.exec();
      const expiredKeys = batch.filter((_, index) => {
        const [error, ttl] = results![index];
        return !error && ((ttl as number) < 0 || (ttl as number) < 60); // Remove if expired or about to expire
      });

      if (expiredKeys.length > 0) {
        await redis.del(...expiredKeys);
      }
    }
  } catch (error) {
    console.error("Redis cleanupStaleFeeds error:", error);
  }
};

// Enhanced Feed Cache Methods
export const getFeedWithMetadata = async (
  userId: number,
  page: number = 1
): Promise<FeedMetadata> => {
  try {
    const feedKey = `${FEED_KEY_PREFIX}${userId}:metadata:${page}`;
    const data = await redis.get(feedKey);

    if (!data) {
      return {
        posts: [],
        lastUpdate: null,
        totalItems: 0,
        hasMore: false,
      };
    }

    return JSON.parse(data);
  } catch (error) {
    console.error("Redis getFeedWithMetadata error:", error);
    throw new APIErrorResponse(500, "Failed to get feed metadata from cache");
  }
};

export const cacheFeedWithMetadata = async (
  userId: number,
  page: number,
  feedData: FeedMetadata
): Promise<void> => {
  try {
    const feedKey = `${FEED_KEY_PREFIX}${userId}:metadata:${page}`;
    const dataToCache = {
      ...feedData,
      posts: feedData.posts.map((post) => ({
        ...post,
        source: {
          type: post.source.type,
          weight: post.source.weight,
        },
      })),
    };

    await redis
      .multi()
      .set(feedKey, JSON.stringify(dataToCache))
      .expire(feedKey, FEED_EXPIRY)
      .exec();
  } catch (error) {
    console.error("Redis cacheFeedWithMetadata error:", error);
    throw new APIErrorResponse(500, "Failed to cache feed with metadata");
  }
};

// Follower Cache Methods
export const cacheUserFollowers = async (
  userId: number,
  followerIds: number[]
): Promise<void> => {
  try {
    const key = `${USER_FOLLOWERS_PREFIX}${userId}`;
    await redis.sadd(key, ...followerIds.map((id) => id.toString()));
  } catch (error) {
    console.error("Redis cacheUserFollowers error:", error);
    throw new APIErrorResponse(500, "Failed to cache user followers");
  }
};

export const getUserFollowers = async (userId: number): Promise<string[]> => {
  try {
    const key = `${USER_FOLLOWERS_PREFIX}${userId}`;
    return await redis.smembers(key);
  } catch (error) {
    console.error("Redis getUserFollowers error:", error);
    throw new APIErrorResponse(500, "Failed to get user followers");
  }
};

// Metrics Management
export const incrMetric = async (key: string): Promise<void> => {
  try {
    await redis.incr(`metrics:${key}`);
  } catch (error) {
    console.error("Redis incrMetric error:", error);
  }
};

export const getMetric = async (key: string): Promise<number> => {
  try {
    const value = await redis.get(`metrics:${key}`);
    return value ? parseInt(value) : 0;
  } catch (error) {
    console.error("Redis getMetric error:", error);
    return 0;
  }
};

export const storeMetric = async (
  key: string,
  value: number,
  expiry: number
): Promise<void> => {
  try {
    const pipeline = redis.pipeline();
    pipeline.lpush(key, value.toString());
    pipeline.ltrim(key, 0, 999); // Keep last 1000 values
    pipeline.expire(key, expiry);
    await pipeline.exec();
  } catch (error) {
    console.error("Redis storeMetric error:", error);
  }
};

export const cleanupMetrics = async (): Promise<void> => {
  try {
    const keys = await redis.keys("metrics:*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error("Redis cleanupMetrics error:", error);
  }
};

// View State Cache Methods
export const setViewState = async (
  key: string,
  viewState: any,
  ttl: number
): Promise<void> => {
  try {
    await redis
      .multi()
      .set(key, JSON.stringify(viewState))
      .expire(key, ttl)
      .exec();
  } catch (error) {
    console.error("Redis setViewState error:", error);
    throw new APIErrorResponse(500, "Failed to cache view state");
  }
};

export const getViewState = async (key: string): Promise<any | null> => {
  try {
    const viewState = await redis.get(key);
    return viewState ? JSON.parse(viewState) : null;
  } catch (error) {
    console.error("Redis getViewState error:", error);
    throw new APIErrorResponse(500, "Failed to get view state from cache");
  }
};

export const invalidateViewState = async (key: string): Promise<void> => {
  try {
    await redis.del(key);
  } catch (error) {
    console.error("Redis invalidateViewState error:", error);
    throw new APIErrorResponse(500, "Failed to invalidate view state cache");
  }
};

// Batch operations for view states
export const batchGetViewStates = async (keys: string[]): Promise<any[]> => {
  try {
    const pipeline = redis.pipeline();
    keys.forEach((key) => pipeline.get(key));
    const results = await pipeline.exec();
    return results!.map(([error, result]) => {
      if (error) return null;
      return result ? JSON.parse(result as string) : null;
    });
  } catch (error) {
    console.error("Redis batchGetViewStates error:", error);
    throw new APIErrorResponse(500, "Failed to get view states in batch");
  }
};

export const batchSetViewStates = async (
  entries: { key: string; value: any; ttl: number }[]
): Promise<void> => {
  try {
    const pipeline = redis.pipeline();
    entries.forEach(({ key, value, ttl }) => {
      pipeline.set(key, JSON.stringify(value));
      pipeline.expire(key, ttl);
    });
    await pipeline.exec();
  } catch (error) {
    console.error("Redis batchSetViewStates error:", error);
    throw new APIErrorResponse(500, "Failed to set view states in batch");
  }
};

// Position tracking methods
export const setWithExpiry = async (
  key: string,
  value: any,
  ttl: number
): Promise<void> => {
  try {
    await redis.multi().set(key, JSON.stringify(value)).expire(key, ttl).exec();
  } catch (error) {
    console.error("Redis setWithExpiry error:", error);
    throw new APIErrorResponse(500, "Failed to set value with expiry");
  }
};

export const get = async (key: string): Promise<any | null> => {
  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error("Redis get error:", error);
    throw new APIErrorResponse(500, "Failed to get value");
  }
};

export const del = async (key: string): Promise<void> => {
  try {
    await redis.del(key);
  } catch (error) {
    console.error("Redis del error:", error);
    throw new APIErrorResponse(500, "Failed to delete key");
  }
};

export const mget = async (keys: string[]): Promise<any[]> => {
  try {
    const values = await redis.mget(keys);
    return values.map((value) => (value ? JSON.parse(value) : null));
  } catch (error) {
    console.error("Redis mget error:", error);
    throw new APIErrorResponse(500, "Failed to get multiple values");
  }
};

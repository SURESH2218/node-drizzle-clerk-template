import * as redisService from "./redis.service";
import APIErrorResponse from "../lib/APIErrorResponse";
import { db } from "../db/db";
import { viewStates } from "../models/schema/view_state.schema";
import { sql } from "drizzle-orm";

const ANALYTICS_KEY_PREFIX = "analytics:feed:";
const ANALYTICS_TTL = 60 * 60 * 24; // 24 hours

interface FeedMetrics {
  impressions: number;
  views: number;
  completionRate: number;
  averageScrollDepth: number;
  bounceRate: number;
  refreshCount: number;
  prefetchHitRate: number;
}

interface ContentTypeMetrics {
  type: string;
  viewCount: number;
  completionRate: number;
  engagementScore: number;
}

// Track feed impression
export const trackFeedImpression = async (
  userId: number,
  feedType: string = "main"
): Promise<void> => {
  try {
    console.log(
      `[Feed Analytics] Tracking impression for user ${userId}, feed type: ${feedType}`
    );
    const key = `${ANALYTICS_KEY_PREFIX}${userId}:${feedType}:impressions`;
    await redisService.incrMetric(key);
    console.log(`[Feed Analytics] Impression tracked successfully`);
  } catch (error) {
    console.error("[Feed Analytics] Error tracking feed impression:", error);
    throw new APIErrorResponse(500, "Failed to track feed impression");
  }
};

// Track feed view
export const trackFeedView = async (
  userId: number,
  feedType: string = "main",
  viewDuration: number
): Promise<void> => {
  try {
    console.log(
      `[Feed Analytics] Tracking view for user ${userId}, feed type: ${feedType}, duration: ${viewDuration}s`
    );
    const baseKey = `${ANALYTICS_KEY_PREFIX}${userId}:${feedType}`;
    await Promise.all([
      redisService.incrMetric(`${baseKey}:views`),
      redisService.storeMetric(
        `${baseKey}:view_durations`,
        viewDuration,
        ANALYTICS_TTL
      ),
    ]);
    console.log(`[Feed Analytics] View tracked successfully`);
  } catch (error) {
    console.error("[Feed Analytics] Error tracking feed view:", error);
    throw new APIErrorResponse(500, "Failed to track feed view");
  }
};

// Track scroll depth
export const trackScrollDepth = async (
  userId: number,
  feedType: string = "main",
  scrollDepth: number
): Promise<void> => {
  try {
    const key = `${ANALYTICS_KEY_PREFIX}${userId}:${feedType}:scroll_depths`;
    await redisService.storeMetric(key, scrollDepth, ANALYTICS_TTL);
  } catch (error) {
    console.error("Error tracking scroll depth:", error);
    throw new APIErrorResponse(500, "Failed to track scroll depth");
  }
};

// Track feed refresh
export const trackFeedRefresh = async (
  userId: number,
  feedType: string = "main"
): Promise<void> => {
  try {
    const key = `${ANALYTICS_KEY_PREFIX}${userId}:${feedType}:refreshes`;
    await redisService.incrMetric(key);
  } catch (error) {
    console.error("Error tracking feed refresh:", error);
    throw new APIErrorResponse(500, "Failed to track feed refresh");
  }
};

// Track prefetch hit/miss
export const trackPrefetchHit = async (
  userId: number,
  feedType: string = "main",
  isHit: boolean
): Promise<void> => {
  try {
    const baseKey = `${ANALYTICS_KEY_PREFIX}${userId}:${feedType}:prefetch`;
    await redisService.incrMetric(
      isHit ? `${baseKey}:hits` : `${baseKey}:misses`
    );
  } catch (error) {
    console.error("Error tracking prefetch hit:", error);
    throw new APIErrorResponse(500, "Failed to track prefetch hit");
  }
};

// Get feed metrics
export const getFeedMetrics = async (
  userId: number,
  feedType: string = "main"
): Promise<FeedMetrics> => {
  try {
    console.log(
      `[Feed Analytics] Getting metrics for user ${userId}, feed type: ${feedType}`
    );
    const baseKey = `${ANALYTICS_KEY_PREFIX}${userId}:${feedType}`;

    const [
      impressions,
      views,
      scrollDepths,
      refreshCount,
      prefetchHits,
      prefetchMisses,
    ] = await Promise.all([
      redisService.getMetric(`${baseKey}:impressions`),
      redisService.getMetric(`${baseKey}:views`),
      redisService.get(`${baseKey}:scroll_depths`),
      redisService.getMetric(`${baseKey}:refreshes`),
      redisService.getMetric(`${baseKey}:prefetch:hits`),
      redisService.getMetric(`${baseKey}:prefetch:misses`),
    ]);

    const scrollDepthArray = scrollDepths ? JSON.parse(scrollDepths) : [];
    const averageScrollDepth =
      scrollDepthArray.length > 0
        ? scrollDepthArray.reduce((a: number, b: number) => a + b, 0) /
          scrollDepthArray.length
        : 0;

    const bounceRate = views > 0 ? (impressions - views) / impressions : 0;
    const prefetchTotal = prefetchHits + prefetchMisses;
    const prefetchHitRate =
      prefetchTotal > 0 ? prefetchHits / prefetchTotal : 0;

    // Calculate completion rate from view states
    const completionRates = await db
      .select({
        avgCompletion: sql<number>`AVG(read_percentage)::float`,
      })
      .from(viewStates)
      .where(sql`user_id = ${userId}`);

    const completionRate = completionRates[0]?.avgCompletion || 0;

    const metrics = {
      impressions,
      views,
      completionRate,
      averageScrollDepth,
      bounceRate,
      refreshCount,
      prefetchHitRate,
    };

    console.log(`[Feed Analytics] Metrics retrieved:`, metrics);
    return metrics;
  } catch (error) {
    console.error("[Feed Analytics] Error getting feed metrics:", error);
    throw new APIErrorResponse(500, "Failed to get feed metrics");
  }
};

// Get content type performance metrics
export const getContentTypeMetrics = async (
  userId: number,
  feedType: string = "main"
): Promise<ContentTypeMetrics[]> => {
  try {
    const result = await db.execute(sql`
      SELECT 
        posts.content_type as type,
        COUNT(DISTINCT view_states.id) as view_count,
        AVG(view_states.read_percentage)::float as completion_rate,
        AVG(
          CASE 
            WHEN view_states.has_liked THEN 1
            WHEN view_states.has_commented THEN 2
            WHEN view_states.has_shared THEN 3
            ELSE 0
          END
        )::float as engagement_score
      FROM view_states
      JOIN posts ON view_states.post_id = posts.id
      WHERE view_states.user_id = ${userId}
      GROUP BY posts.content_type
    `);

    return result as unknown as ContentTypeMetrics[];
  } catch (error) {
    console.error("Error getting content type metrics:", error);
    throw new APIErrorResponse(500, "Failed to get content type metrics");
  }
};

// Cleanup old analytics data
export const cleanupAnalytics = async (userId: number): Promise<void> => {
  try {
    const pattern = `${ANALYTICS_KEY_PREFIX}${userId}:*`;
    const keys = await redisService.getMetric(pattern);
    if (keys > 0) {
      await redisService.del(pattern);
    }
  } catch (error) {
    console.error("Error cleaning up analytics:", error);
    throw new APIErrorResponse(500, "Failed to cleanup analytics");
  }
};

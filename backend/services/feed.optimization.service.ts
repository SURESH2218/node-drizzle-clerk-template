import * as feedAnalyticsService from "./feed.analytics.service";
import * as contentDiversityService from "./content_diversity.service";
import APIErrorResponse from "../lib/APIErrorResponse";

interface OptimizationWeights {
  contentTypeWeight: number;
  completionRateWeight: number;
  engagementWeight: number;
  timeWeight: number;
}

const DEFAULT_WEIGHTS: OptimizationWeights = {
  contentTypeWeight: 0.3,
  completionRateWeight: 0.3,
  engagementWeight: 0.25,
  timeWeight: 0.15,
};

// Optimize content mix based on user analytics
export const optimizeContentMix = async (
  userId: number,
  weights: Partial<OptimizationWeights> = {}
): Promise<any> => {
  try {
    // Get user metrics
    const [feedMetrics, contentMetrics] = await Promise.all([
      feedAnalyticsService.getFeedMetrics(userId),
      feedAnalyticsService.getContentTypeMetrics(userId),
    ]);

    // Calculate optimal content type distribution
    const contentTypeDistribution = calculateContentTypeDistribution(
      contentMetrics,
      { ...DEFAULT_WEIGHTS, ...weights }
    );

    // Get diverse content with optimized weights
    return await contentDiversityService.getDiverseContentMix(userId, {
      contentTypes: {
        RESEARCH_PAPER: contentTypeDistribution.RESEARCH_PAPER || 0.35,
        NEWS_UPDATE: contentTypeDistribution.NEWS_UPDATE || 0.25,
        DISCUSSION: contentTypeDistribution.DISCUSSION || 0.2,
        ANNOUNCEMENT: contentTypeDistribution.ANNOUNCEMENT || 0.15,
        OTHER: contentTypeDistribution.OTHER || 0.05,
      },
      sources: {
        FOLLOWED: Math.min(0.4, feedMetrics.completionRate || 0.35),
        SPECIALIZATION: Math.min(0.4, 1 - (feedMetrics.bounceRate || 0.3)),
        TRENDING: Math.min(0.3, feedMetrics.prefetchHitRate || 0.2),
        DISCOVERY: 0.1,
      },
    });
  } catch (error) {
    console.error("Error optimizing content mix:", error);
    throw new APIErrorResponse(500, "Failed to optimize content mix");
  }
};

// Calculate optimal content type distribution
const calculateContentTypeDistribution = (
  metrics: Array<{
    type: string;
    viewCount: number;
    completionRate: number;
    engagementScore: number;
  }>,
  weights: OptimizationWeights
) => {
  type ContentType =
    | "RESEARCH_PAPER"
    | "NEWS_UPDATE"
    | "DISCUSSION"
    | "ANNOUNCEMENT"
    | "OTHER";

  const distribution: Record<ContentType, number> = {
    RESEARCH_PAPER: 0.35,
    NEWS_UPDATE: 0.25,
    DISCUSSION: 0.2,
    ANNOUNCEMENT: 0.15,
    OTHER: 0.05,
  };

  const totalScore = metrics.reduce(
    (sum, metric) =>
      sum +
      metric.viewCount * weights.contentTypeWeight +
      metric.completionRate * weights.completionRateWeight +
      metric.engagementScore * weights.engagementWeight,
    0
  );

  const result = { ...distribution };

  metrics.forEach((metric) => {
    const score =
      (metric.viewCount * weights.contentTypeWeight +
        metric.completionRate * weights.completionRateWeight +
        metric.engagementScore * weights.engagementWeight) /
      totalScore;
    if (metric.type in distribution) {
      result[metric.type as ContentType] = Math.max(0.1, score);
    }
  });

  const total = Object.values(result).reduce((a, b) => a + b, 0);
  Object.keys(result).forEach((key) => {
    result[key as ContentType] = result[key as ContentType] / total;
  });

  return result;
};

// Get feed refresh interval based on user activity
export const getOptimalRefreshInterval = async (
  userId: number
): Promise<number> => {
  try {
    const metrics = await feedAnalyticsService.getFeedMetrics(userId);

    // Base interval is 5 minutes
    const baseInterval = 5 * 60 * 1000;

    // Adjust based on user engagement
    const engagementFactor = calculateEngagementFactor(metrics);

    // Return interval between 1 and 10 minutes
    return Math.max(
      60 * 1000,
      Math.min(10 * 60 * 1000, baseInterval * engagementFactor)
    );
  } catch (error) {
    console.error("Error getting optimal refresh interval:", error);
    return 5 * 60 * 1000; // Default to 5 minutes
  }
};

// Calculate engagement factor for refresh interval
const calculateEngagementFactor = (metrics: any): number => {
  const viewRate = metrics.views / Math.max(1, metrics.impressions);
  const completionFactor = metrics.completionRate / 100;
  const refreshFactor = Math.min(1, metrics.refreshCount / 10);

  return (viewRate + completionFactor + refreshFactor) / 3;
};

// Get optimal prefetch threshold based on user behavior
export const getOptimalPrefetchThreshold = async (
  userId: number
): Promise<number> => {
  try {
    const metrics = await feedAnalyticsService.getFeedMetrics(userId);

    // Base threshold is 0.7 (70%)
    const baseThreshold = 0.7;

    // Adjust based on prefetch hit rate and scroll behavior
    const hitRateFactor = metrics.prefetchHitRate;
    const scrollFactor = metrics.averageScrollDepth / 100;

    // Return threshold between 0.5 and 0.9
    return Math.max(
      0.5,
      Math.min(0.9, (baseThreshold * (hitRateFactor + scrollFactor)) / 2)
    );
  } catch (error) {
    console.error("Error getting optimal prefetch threshold:", error);
    return 0.7; // Default to 70%
  }
};

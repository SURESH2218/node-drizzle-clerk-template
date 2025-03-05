import { db } from "../db/db";
import { posts, userSpecializations } from "../models/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import APIErrorResponse from "../lib/APIErrorResponse";
import * as redisService from "./redis.service";
import {
  FEED_PAGE_SIZE,
  MAX_ITEMS_PER_SOURCE,
} from "../constants/pagination.constants";

// Content type weights for diversity
const CONTENT_TYPE_WEIGHTS = {
  RESEARCH_PAPER: 0.35, // Scientific papers
  NEWS_UPDATE: 0.25, // Field updates
  DISCUSSION: 0.2, // Community discussions
  ANNOUNCEMENT: 0.15, // Events/announcements
  OTHER: 0.05, // Other content types
};

// Time window weights
const TIME_WINDOW_WEIGHTS = {
  LAST_24H: 0.5, // Last 24 hours
  LAST_WEEK: 0.3, // Last week
  LAST_MONTH: 0.2, // Last month
};

// Source diversity weights
const SOURCE_WEIGHTS = {
  FOLLOWED: 100, // From followed users
  SPECIALIZATION: 100, // From user's specializations
  TRENDING: 0.2, // Popular content
  DISCOVERY: 0.1, // New sources
};

interface ContentMixConfig {
  contentTypes: typeof CONTENT_TYPE_WEIGHTS;
  timeWindows: typeof TIME_WINDOW_WEIGHTS;
  sources: typeof SOURCE_WEIGHTS;
}

interface PaginatedResponse<T> {
  items: T[];
  totalItems: number;
  hasMore: boolean;
}

// Generate time window queries
const generateTimeWindowQueries = () => {
  const now = new Date();
  const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return sql`${posts.createdAt} >= ${lastMonth}`;
};

// Get content from followed users
const getFollowedContent = async (
  userId: number,
  config: ContentMixConfig
): Promise<any[]> => {
  const timeQueries = generateTimeWindowQueries();

  return await db.query.posts.findMany({
    where: and(
      sql`${posts.userId} IN (
        SELECT "following_id" FROM follows 
        WHERE "follower_id" = ${userId}
      )`,
      timeQueries
    ),
    with: {
      author: true,
      specialization: true,
      media: true,
    },
    orderBy: [desc(posts.createdAt)],
  });
};

// Get content based on user specializations
const getSpecializationContent = async (
  userId: number,
  config: ContentMixConfig
): Promise<any[]> => {
  try {
    const userSpecs = await db.query.userSpecializations.findMany({
      where: eq(userSpecializations.userId, userId),
    });

    const specIds = userSpecs
      .map((spec) => spec.specializationId)
      .filter((id): id is number => id !== null);

    if (!specIds.length) return [];

    const timeQueries = generateTimeWindowQueries();

    return await db.query.posts.findMany({
      where: and(inArray(posts.specializationId, specIds), timeQueries),
      with: {
        author: true,
        specialization: true,
        media: true,
      },
      orderBy: [desc(posts.createdAt)],
    });
  } catch (error) {
    console.error(
      "[Content Diversity] Error getting specialization content:",
      error
    );
    return [];
  }
};

// Get trending content
const getTrendingContent = async (config: ContentMixConfig): Promise<any[]> => {
  try {
    const popularPostIds = await redisService.getPopularPosts();
    const timeQueries = generateTimeWindowQueries();

    // If no popular posts, return empty array
    if (!popularPostIds.length) {
      return [];
    }

    // Convert string IDs to numbers
    const numericIds = popularPostIds.map(Number).filter((id) => !isNaN(id));

    return await db.query.posts.findMany({
      where: and(
        sql`${posts.id} = ANY(ARRAY[${sql.join(numericIds)}]::integer[])`,
        timeQueries
      ),
      with: {
        author: true,
        specialization: true,
        media: true,
      },
    });
  } catch (error) {
    console.error("[Content Diversity] Error getting trending content:", error);
    return [];
  }
};

// Get discovery content
const getDiscoveryContent = async (
  userId: number,
  config: ContentMixConfig
): Promise<any[]> => {
  const timeQueries = generateTimeWindowQueries();

  return await db.query.posts.findMany({
    where: and(
      sql`${posts.userId} NOT IN (
        SELECT "following_id" FROM follows 
        WHERE "follower_id" = ${userId}
      )`,
      timeQueries,
      sql`${posts.likes} >= 10` // Minimum engagement threshold
    ),
    with: {
      author: true,
      specialization: true,
      media: true,
    },
    orderBy: [desc(posts.likes), desc(posts.createdAt)],
  });
};

// Modify balanceContent to handle pagination
const balanceContent = (
  contentGroups: Array<{
    content: any[];
    weight: number;
    type: "FOLLOWED" | "SPECIALIZATION" | "TRENDING" | "DISCOVERY";
  }>,
  page: number
): PaginatedResponse<any> => {
  const postMap = new Map<number, any>();
  let totalItems = 0;

  // Process each content group
  contentGroups.forEach((group) => {
    const targetItems = Math.floor(MAX_ITEMS_PER_SOURCE * group.weight);

    group.content.forEach((post) => {
      if (!postMap.has(post.id)) {
        totalItems++;
        postMap.set(post.id, {
          ...post,
          source: {
            type: group.type,
            weight: group.weight,
          },
        });
      } else {
        // Update weight if higher
        const existingPost = postMap.get(post.id);
        if (group.weight > existingPost.source.weight) {
          existingPost.source = {
            type: group.type,
            weight: group.weight,
          };
          postMap.set(post.id, existingPost);
        }
      }
    });
  });

  // Convert Map to array and sort
  const allPosts = Array.from(postMap.values()).sort((a, b) => {
    const weightDiff = b.source.weight - a.source.weight;
    if (weightDiff !== 0) return weightDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Calculate pagination
  const startIndex = (page - 1) * FEED_PAGE_SIZE;
  const endIndex = startIndex + FEED_PAGE_SIZE;
  const paginatedPosts = allPosts.slice(startIndex, endIndex);

  return {
    items: paginatedPosts,
    totalItems: allPosts.length,
    hasMore: endIndex < allPosts.length,
  };
};

// Update getDiverseContentMix to handle pagination
export const getDiverseContentMix = async (
  userId: number,
  page: number = 1,
  config: Partial<ContentMixConfig> = {}
): Promise<PaginatedResponse<any>> => {
  try {
    if (page < 1) page = 1; // Ensure page is at least 1

    console.log(
      `[Content Diversity] Getting diverse content mix for user ${userId}, page ${page}`
    );

    const finalConfig = {
      contentTypes: { ...CONTENT_TYPE_WEIGHTS, ...config.contentTypes },
      timeWindows: { ...TIME_WINDOW_WEIGHTS, ...config.timeWindows },
      sources: { ...SOURCE_WEIGHTS, ...config.sources },
    };

    // Fetch content from all sources
    const [
      followedContent,
      specializationContent,
      trendingContent,
      discoveryContent,
    ] = await Promise.all([
      getFollowedContent(userId, finalConfig),
      getSpecializationContent(userId, finalConfig),
      getTrendingContent(finalConfig),
      getDiscoveryContent(userId, finalConfig),
    ]);

    // Balance and paginate content
    const balancedContent = balanceContent(
      [
        {
          content: followedContent,
          weight: finalConfig.sources.FOLLOWED,
          type: "FOLLOWED",
        },
        {
          content: specializationContent,
          weight: finalConfig.sources.SPECIALIZATION,
          type: "SPECIALIZATION",
        },
        {
          content: trendingContent,
          weight: finalConfig.sources.TRENDING,
          type: "TRENDING",
        },
        {
          content: discoveryContent,
          weight: finalConfig.sources.DISCOVERY,
          type: "DISCOVERY",
        },
      ],
      page
    );

    console.log(
      `[Content Diversity] Generated feed page ${page} with ${balancedContent.items.length} items. ` +
        `Total items: ${balancedContent.totalItems}, Has more: ${balancedContent.hasMore}`
    );

    return balancedContent;
  } catch (error) {
    console.error(
      "[Content Diversity] Error getting diverse content mix:",
      error
    );
    throw new APIErrorResponse(500, "Failed to get diverse content mix");
  }
};

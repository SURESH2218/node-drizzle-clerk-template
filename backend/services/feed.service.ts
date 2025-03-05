// services/feed/feed.service.ts

import { db } from "../db/db";
import {
  posts,
  users,
  follows,
  userSpecializations,
  postLikes,
  comments,
} from "../models/schema";
import { viewStates, ViewState } from "../models/schema/view_state.schema";
import * as redisService from "./redis.service";
import APIErrorResponse from "../lib/APIErrorResponse";
import { eq, and, desc, sql, inArray, notInArray, gte } from "drizzle-orm";
import * as viewStateService from "./view_state.service";
import * as contentDiversityService from "./content_diversity.service";
import { FEED_PAGE_SIZE } from "../constants/pagination.constants";

// Import SOURCE_WEIGHTS from content_diversity.service
const SOURCE_WEIGHTS = {
  FOLLOWED: 0.35,
  SPECIALIZATION: 0.35,
  TRENDING: 0.2,
  DISCOVERY: 0.1,
} as const;

const FEED_WEIGHTS = {
  FOLLOWED_USERS: 0.9,
  SPECIALIZATION: 10,
  POPULAR_POSTS: 0.2,
  RANDOM_DISCOVERY: 0.1,
};

const POST_SCORE_WEIGHTS = {
  RECENCY: 0.3,
  ENGAGEMENT: 0.25,
  RELEVANCE: 0.25,
  AUTHOR_POPULARITY: 0.1,
  VIEW_COMPLETION: 0.1,
};

// Add new constants for differential updates
const DIFFERENTIAL_UPDATE_LIMIT = 50;

// Main feed generation
export const generateFeed = async (
  userId: number,
  page: number = 1,
  lastUpdate?: string
): Promise<{
  posts: any[];
  lastUpdate: string;
  totalItems: number;
  hasMore: boolean;
}> => {
  try {
    if (page < 1) page = 1;

    // Check cache first
    const cachedFeed = await redisService.getFeedWithMetadata(userId, page);
    if (
      cachedFeed.posts.length > 0 &&
      (!lastUpdate || cachedFeed.lastUpdate === lastUpdate)
    ) {
      const filteredPosts = await filterSeenContent(userId, cachedFeed.posts);
      return {
        posts: filteredPosts,
        lastUpdate: cachedFeed.lastUpdate || Date.now().toString(),
        totalItems: cachedFeed.totalItems,
        hasMore: cachedFeed.hasMore,
      };
    }

    // Generate fresh feed
    const diverseContent = await contentDiversityService.getDiverseContentMix(
      userId,
      page
    );
    const timestamp = Date.now().toString();

    const feedData = {
      posts: diverseContent.items,
      lastUpdate: timestamp,
      totalItems: diverseContent.totalItems,
      hasMore: diverseContent.hasMore,
    };

    // Cache the feed with page information
    await redisService.cacheFeedWithMetadata(userId, page, feedData);

    const filteredPosts = await filterSeenContent(userId, diverseContent.items);
    return {
      posts: filteredPosts,
      lastUpdate: timestamp,
      totalItems: diverseContent.totalItems,
      hasMore: diverseContent.hasMore,
    };
  } catch (error) {
    console.error("[Feed Service] Feed generation error:", error);
    throw new APIErrorResponse(500, "Failed to generate feed");
  }
};

export const generateFreshFeed = async (userId: number): Promise<any[]> => {
  try {
    console.log(
      `[Feed Service] Getting diverse content mix for user ${userId}`
    );
    // Get diverse content mix
    const diverseContent = await contentDiversityService.getDiverseContentMix(
      userId
    );

    // Score and rank the diverse content
    console.log(
      `[Feed Service] Scoring and ranking content for user ${userId}`
    );
    const scoredPosts = await Promise.all(
      diverseContent.items.map(async (post) => ({
        ...post,
        score: await calculatePostScore(post, determinePostFeedType(post)),
      }))
    );

    // Sort by score
    const sortedPosts = scoredPosts.sort((a, b) => b.score - a.score);
    console.log(
      `[Feed Service] Generated fresh feed with ${sortedPosts.length} posts`
    );
    return sortedPosts;
  } catch (error) {
    console.error("[Feed Service] Fresh feed generation error:", error);
    throw new APIErrorResponse(500, "Failed to generate fresh feed");
  }
};

// Helper function to determine post feed type
const determinePostFeedType = (post: any): keyof typeof FEED_WEIGHTS => {
  if (post.source?.weight === SOURCE_WEIGHTS.FOLLOWED) return "FOLLOWED_USERS";
  if (post.source?.weight === SOURCE_WEIGHTS.SPECIALIZATION)
    return "SPECIALIZATION";
  if (post.source?.weight === SOURCE_WEIGHTS.TRENDING) return "POPULAR_POSTS";
  return "RANDOM_DISCOVERY";
};

const scoreAndRankPosts = async (
  userId: number,
  followedPosts: any[],
  specializationPosts: any[],
  popularPosts: any[],
  discoveryPosts: any[]
): Promise<any[]> => {
  // Score each post and combine into a single array
  const scoredPosts = await Promise.all([
    ...followedPosts.map((post) => ({
      ...post,
      score: calculatePostScore(post, "FOLLOWED_USERS"),
    })),
    ...specializationPosts.map((post) => ({
      ...post,
      score: calculatePostScore(post, "SPECIALIZATION"),
    })),
    ...popularPosts.map((post) => ({
      ...post,
      score: calculatePostScore(post, "POPULAR_POSTS"),
    })),
    ...discoveryPosts.map((post) => ({
      ...post,
      score: calculatePostScore(post, "RANDOM_DISCOVERY"),
    })),
  ]);

  // Sort by score and return top posts
  return scoredPosts
    .sort((a, b) => b.score - a.score)
    .slice(0, FEED_PAGE_SIZE * 3);
};

const calculatePostScore = async (
  post: any,
  feedType: keyof typeof FEED_WEIGHTS
): Promise<number> => {
  const baseScore = FEED_WEIGHTS[feedType];
  const [
    recencyScore,
    engagementScore,
    relevanceScore,
    authorPopularityScore,
    viewCompletionScore,
  ] = await Promise.all([
    calculateRecencyScore(post.createdAt),
    calculateEngagementScore(post),
    calculateRelevanceScore(post),
    calculateAuthorPopularityScore(post.userId),
    calculateViewCompletionScore(post.id),
  ]);

  return (
    baseScore *
    (recencyScore * POST_SCORE_WEIGHTS.RECENCY +
      engagementScore * POST_SCORE_WEIGHTS.ENGAGEMENT +
      relevanceScore * POST_SCORE_WEIGHTS.RELEVANCE +
      authorPopularityScore * POST_SCORE_WEIGHTS.AUTHOR_POPULARITY +
      viewCompletionScore * POST_SCORE_WEIGHTS.VIEW_COMPLETION)
  );
};

const getPopularPosts = async (): Promise<any[]> => {
  try {
    const popularPostIds = await redisService.getPopularPosts();
    if (!popularPostIds.length) return [];

    return await db.query.posts.findMany({
      where: inArray(posts.id, popularPostIds.map(Number)),
      with: {
        author: true,
        media: true,
        specialization: true,
      },
    });
  } catch (error) {
    console.error("Error getting popular posts:", error);
    return [];
  }
};

const getDiscoveryPosts = async (userId: number): Promise<any[]> => {
  try {
    // Get posts from users not followed, but with high engagement
    return await db.query.posts.findMany({
      where: and(
        notInArray(
          posts.userId,
          db
            .select({ id: follows.followingId })
            .from(follows)
            .where(eq(follows.followerId, userId))
        ),
        gte(posts.likes, 10) // Minimum engagement threshold
      ),
      with: {
        author: true,
        media: true,
        specialization: true,
      },
      limit: FEED_PAGE_SIZE,
      orderBy: [desc(posts.likes), desc(posts.createdAt)],
    });
  } catch (error) {
    console.error("Error getting discovery posts:", error);
    return [];
  }
};

const paginateFeed = (feed: any[], page: number): any[] => {
  const start = (page - 1) * FEED_PAGE_SIZE;
  const end = start + FEED_PAGE_SIZE;
  return feed.slice(start, end);
};

// Modified version of getFollowedUsersPosts with timestamp
const getFollowedUsersPosts = async (
  userId: number,
  since?: Date
): Promise<any[]> => {
  try {
    return await db
      .select({
        id: posts.id,
        title: posts.title,
        content: posts.content,
        userId: posts.userId,
        specializationId: posts.specializationId,
        createdAt: posts.createdAt,
        likes: posts.likes,
        views: posts.views,
      })
      .from(posts)
      .innerJoin(follows, eq(posts.userId, follows.followingId))
      .where(
        and(
          eq(follows.followerId, userId),
          since
            ? gte(posts.createdAt, since)
            : sql`${posts.createdAt} > NOW() - INTERVAL '7 days'`
        )
      )
      .orderBy(desc(posts.createdAt));
  } catch (error) {
    console.error("Error getting followed users posts:", error);
    throw new APIErrorResponse(500, "Failed to get followed users posts");
  }
};

// Modified version of getSpecializationPosts with timestamp
export const getSpecializationPosts = async (
  userId: number,
  since?: Date
): Promise<any[]> => {
  try {
    const userSpecializations = await getUserSpecializations(userId);
    return await getSpecializationBasedPosts(
      userId,
      userSpecializations,
      since
    );
  } catch (error) {
    console.error("Error getting specialization posts:", error);
    throw new APIErrorResponse(500, "Failed to get specialization posts");
  }
};

export const getSpecializationBasedPosts = async (
  userId: number,
  userSpecializationIds: number[],
  since?: Date
): Promise<any[]> => {
  try {
    if (userSpecializationIds.length === 0) return [];

    const conditions = [
      inArray(posts.specializationId, userSpecializationIds),
      sql`${posts.createdAt} > NOW() - INTERVAL '7 days'`,
      notInArray(
        posts.userId,
        db
          .select({ id: follows.followingId })
          .from(follows)
          .where(eq(follows.followerId, userId))
      ),
    ];

    if (since) {
      conditions.push(gte(posts.createdAt, since));
    }

    return await db
      .select({
        id: posts.id,
        title: posts.title,
        content: posts.content,
        userId: posts.userId,
        specializationId: posts.specializationId,
        createdAt: posts.createdAt,
        likes: posts.likes,
        views: posts.views,
      })
      .from(posts)
      .where(and(...conditions))
      .orderBy(desc(posts.createdAt));
  } catch (error) {
    console.error("Error getting specialization posts:", error);
    throw new APIErrorResponse(500, "Failed to get specialization posts");
  }
};

const calculateRecencyScore = (postDate: Date | string | undefined): number => {
  if (!postDate) return 1.0;
  const now = new Date();
  const postDateTime = postDate instanceof Date ? postDate : new Date(postDate);
  if (isNaN(postDateTime.getTime())) return 1.0;
  const hoursOld = (now.getTime() - postDateTime.getTime()) / (1000 * 60 * 60);
  return Math.exp(-hoursOld / 72);
};

export const getPostEngagement = async (
  postId: number
): Promise<{ likes: number; comments: number }> => {
  try {
    const [likesCount, commentsCount] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(postLikes)
        .where(eq(postLikes.postId, postId)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(comments)
        .where(eq(comments.postId, postId)),
    ]);

    return {
      likes: likesCount[0].count,
      comments: commentsCount[0].count,
    };
  } catch (error) {
    console.error("Error getting post engagement:", error);
    throw new APIErrorResponse(500, "Failed to get post engagement");
  }
};

const calculateEngagementScore = async (post: any): Promise<number> => {
  const engagementData = await getPostEngagement(post.id);
  const { likes, comments } = engagementData;
  const likesWeight = 1;
  const commentsWeight = 2;
  const totalEngagement = likes * likesWeight + comments * commentsWeight;
  return Math.min(totalEngagement / 100, 1);
};

const calculateRelevanceScore = (post: any): number => {
  // Implementation of calculateRelevanceScore
  return 0.5; // Placeholder return, actual implementation needed
};

const calculateAuthorPopularityScore = async (
  authorId: number
): Promise<number> => {
  // Implementation of calculateAuthorPopularityScore
  return 0.5; // Placeholder return, actual implementation needed
};

export const getAffectedUsers = async (
  userId: number,
  specializationId: number
): Promise<number[]> => {
  try {
    const followers = await db
      .select({ id: users.id })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(eq(follows.followingId, userId));

    const specializationUsers = await getUsersBySpecialization(
      specializationId
    );

    const affectedUserIds = new Set([
      ...followers.map((f) => f.id),
      ...specializationUsers.map((u) => u.id),
    ]);

    console.log("affectedUserIds", affectedUserIds);

    return Array.from(affectedUserIds);
  } catch (error) {
    console.error("Get affected users error:", error);
    throw new APIErrorResponse(500, "Failed to get affected users");
  }
};

export const updateFeedForNewFollow = async (
  followerId: number,
  followingId: number
): Promise<void> => {
  try {
    const recentPosts = await getRecentUserPosts(followingId);
    console.log("recentPosts", recentPosts);
    const updatedFeed = await scoreAndRankPosts(
      followerId,
      recentPosts,
      await getSpecializationPosts(followerId),
      await getPopularPosts(),
      await getDiscoveryPosts(followerId)
    );
    console.log("updatedFeed", updatedFeed);
    await redisService.cacheFeed(followerId, updatedFeed);
  } catch (error) {
    console.error("Feed update error:", error);
    throw new APIErrorResponse(500, "Failed to update feed for new follow");
  }
};

export const addPostToFeeds = async (
  postData: any,
  affectedUserIds: number[]
): Promise<void> => {
  console.log("new post added to feeds");
  try {
    const post = {
      ...postData,
      createdAt: postData.createdAt || new Date(),
    };

    const batchSize = 100;
    for (let i = 0; i < affectedUserIds.length; i += batchSize) {
      const userBatch = affectedUserIds.slice(i, i + batchSize);

      await Promise.all(
        userBatch.map(async (userId) => {
          const currentFeed = await redisService.getFeed(userId);
          const updatedFeed = await scoreAndRankPosts(
            userId,
            [post, ...currentFeed.map((p) => JSON.parse(p))],
            await getSpecializationPosts(userId),
            await getPopularPosts(),
            await getDiscoveryPosts(userId)
          );
          await redisService.cacheFeed(userId, updatedFeed);
        })
      );
    }
  } catch (error) {
    console.error("Failed to add post to feeds:", error);
    throw new APIErrorResponse(500, "Failed to update feeds with new post");
  }
};

const getUserSpecializations = async (userId: number): Promise<number[]> => {
  const userSpecs = await db
    .select({ specializationId: userSpecializations.specializationId })
    .from(userSpecializations)
    .where(eq(userSpecializations.userId, userId));

  return userSpecs
    .map((spec) => spec.specializationId)
    .filter((id): id is number => id !== null);
};

export const getUsersBySpecialization = async (
  specializationId: number
): Promise<{ id: number }[]> => {
  try {
    return await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(userSpecializations, eq(users.id, userSpecializations.userId))
      .where(eq(userSpecializations.specializationId, specializationId));
  } catch (error) {
    console.error("Error getting users by specialization:", error);
    throw new APIErrorResponse(500, "Failed to get users by specialization");
  }
};

const getRecentUserPosts = async (userId: number): Promise<any[]> => {
  return await db
    .select()
    .from(posts)
    .where(
      and(eq(posts.userId, userId), sql`created_at > NOW() - INTERVAL '7 days'`)
    )
    .orderBy(desc(posts.createdAt));
};

// Get new popular posts since last update
const getNewPopularPosts = async (since: number): Promise<any[]> => {
  try {
    const popularPostIds = await redisService.getPopularPostsSince(since);
    if (!popularPostIds.length) return [];

    return await db.query.posts.findMany({
      where: inArray(posts.id, popularPostIds.map(Number)),
      with: {
        author: true,
        media: true,
        specialization: true,
      },
    });
  } catch (error) {
    console.error("Error getting new popular posts:", error);
    return [];
  }
};

// Add new methods for differential updates
export const getDifferentialUpdates = async (
  userId: number,
  lastUpdate: string
): Promise<{ posts: any[]; lastUpdate: string }> => {
  try {
    const lastUpdateTime = parseInt(lastUpdate);
    if (isNaN(lastUpdateTime)) {
      throw new APIErrorResponse(400, "Invalid lastUpdate timestamp");
    }

    // Get new posts since last update
    const [newFollowedPosts, newSpecializationPosts, newPopularPosts] =
      await Promise.all([
        getFollowedUsersPosts(userId, new Date(lastUpdateTime)),
        getSpecializationPosts(userId, new Date(lastUpdateTime)),
        getNewPopularPosts(lastUpdateTime),
      ]);

    // Score and rank new posts
    const scoredPosts = await scoreAndRankPosts(
      userId,
      newFollowedPosts,
      newSpecializationPosts,
      newPopularPosts,
      [] // No discovery posts for differential updates
    );

    // Limit the number of updates
    const limitedPosts = scoredPosts.slice(0, DIFFERENTIAL_UPDATE_LIMIT);
    const timestamp = Date.now();

    return {
      posts: limitedPosts,
      lastUpdate: timestamp.toString(),
    };
  } catch (error) {
    console.error("Differential update error:", error);
    throw new APIErrorResponse(500, "Failed to get differential updates");
  }
};

// Filter out completely viewed content and prioritize unseen content
const filterSeenContent = async (
  userId: number,
  posts: any[]
): Promise<any[]> => {
  try {
    const viewStates = await Promise.all(
      posts.map((post) => viewStateService.getViewState(userId, post.id))
    );

    return posts.filter((_, index) => {
      const viewState = viewStates[index];
      return !viewState || viewState.viewStatus !== "complete_view";
    });
  } catch (error) {
    console.error("[Feed Service] Error filtering seen content:", error);
    return posts; // Return original posts if filtering fails
  }
};

// Update the calculateViewCompletionScore function with proper types
const calculateViewCompletionScore = async (
  postId: number
): Promise<number> => {
  try {
    // Get view states for this post
    const postViewStates = await db.query.viewStates.findMany({
      where: eq(viewStates.postId, postId),
    });

    if (!postViewStates.length) return 1.0; // Default score for new posts

    // Calculate average completion rate
    const totalCompletionRate = postViewStates.reduce(
      (sum: number, state: ViewState) => {
        return sum + (state.readPercentage || 0);
      },
      0
    );

    const averageCompletionRate = totalCompletionRate / postViewStates.length;

    // Convert to a 0-1 score
    return Math.min(averageCompletionRate / 100, 1);
  } catch (error) {
    console.error("Error calculating view completion score:", error);
    return 0.5; // Default score on error
  }
};

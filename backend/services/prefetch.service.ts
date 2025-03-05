import * as redisService from "./redis.service";
import * as feedService from "./feed.service";
import * as contentDiversityService from "./content_diversity.service";
import APIErrorResponse from "../lib/APIErrorResponse";

const PREFETCH_KEY_PREFIX = "prefetch:";
const PREFETCH_TTL = 60 * 5; // 5 minutes
const PREFETCH_BATCH_SIZE = 20;
const PREFETCH_THRESHOLD = 0.7; // When user has viewed 70% of current content

interface PrefetchState {
  userId: number;
  lastPrefetchTime: number;
  prefetchedIds: number[];
  currentPage: number;
}

// Initialize prefetch state
export const initPrefetchState = async (
  userId: number,
  currentPage: number = 1
): Promise<void> => {
  try {
    const key = `${PREFETCH_KEY_PREFIX}${userId}`;
    const state: PrefetchState = {
      userId,
      lastPrefetchTime: Date.now(),
      prefetchedIds: [],
      currentPage,
    };
    await redisService.setWithExpiry(key, state, PREFETCH_TTL);
  } catch (error) {
    console.error("Error initializing prefetch state:", error);
    throw new APIErrorResponse(500, "Failed to initialize prefetch state");
  }
};

// Get prefetch state
export const getPrefetchState = async (
  userId: number
): Promise<PrefetchState | null> => {
  try {
    const key = `${PREFETCH_KEY_PREFIX}${userId}`;
    return await redisService.get(key);
  } catch (error) {
    console.error("Error getting prefetch state:", error);
    throw new APIErrorResponse(500, "Failed to get prefetch state");
  }
};

// Prefetch next batch of content
export const prefetchNextBatch = async (
  userId: number,
  currentScrollPosition: number,
  totalHeight: number
): Promise<void> => {
  try {
    // Check if we need to prefetch
    const scrollPercentage = currentScrollPosition / totalHeight;
    if (scrollPercentage < PREFETCH_THRESHOLD) {
      return;
    }

    const state = await getPrefetchState(userId);
    if (!state) {
      await initPrefetchState(userId);
      return;
    }

    // Get next batch of content
    const nextPage = state.currentPage + 1;
    const { posts } = await feedService.generateFeed(userId, nextPage);

    // Store prefetched content (limit to batch size)
    const prefetchedPosts = posts.slice(0, PREFETCH_BATCH_SIZE).map((post) => ({
      ...post,
      prefetched: true,
      prefetchTime: Date.now(),
    }));

    await redisService.cacheFeed(userId, prefetchedPosts);

    // Update prefetch state
    const updatedState: PrefetchState = {
      ...state,
      lastPrefetchTime: Date.now(),
      prefetchedIds: [...state.prefetchedIds, ...posts.map((p) => p.id)],
      currentPage: nextPage,
    };

    await redisService.setWithExpiry(
      `${PREFETCH_KEY_PREFIX}${userId}`,
      updatedState,
      PREFETCH_TTL
    );
  } catch (error) {
    console.error("Error prefetching content:", error);
    throw new APIErrorResponse(500, "Failed to prefetch content");
  }
};

// Prefetch content for specific specializations
export const prefetchSpecializationContent = async (
  userId: number,
  specializationIds: number[]
): Promise<void> => {
  try {
    const diverseContent = await contentDiversityService.getDiverseContentMix(
      userId,
      {
        sources: {
          SPECIALIZATION: 0.7, // Increase specialization content weight
          FOLLOWED: 0,
          TRENDING: 0.1,
          DISCOVERY: 0.1,
        },
      }
    );

    const prefetchedPosts = diverseContent.map((post) => ({
      ...post,
      prefetched: true,
      prefetchTime: Date.now(),
      feedType: `specialized_${specializationIds.join("_")}`,
    }));

    await redisService.cacheFeed(userId, prefetchedPosts);
  } catch (error) {
    console.error("Error prefetching specialization content:", error);
    throw new APIErrorResponse(
      500,
      "Failed to prefetch specialization content"
    );
  }
};

// Prefetch trending content
export const prefetchTrendingContent = async (
  userId: number
): Promise<void> => {
  try {
    const diverseContent = await contentDiversityService.getDiverseContentMix(
      userId,
      {
        sources: {
          TRENDING: 0.7, // Increase trending content weight
          SPECIALIZATION: 0.1,
          FOLLOWED: 0.1,
          DISCOVERY: 0.1,
        },
      }
    );

    const prefetchedPosts = diverseContent.map((post) => ({
      ...post,
      prefetched: true,
      prefetchTime: Date.now(),
      feedType: "trending",
    }));

    await redisService.cacheFeed(userId, prefetchedPosts);
  } catch (error) {
    console.error("Error prefetching trending content:", error);
    throw new APIErrorResponse(500, "Failed to prefetch trending content");
  }
};

// Clean up old prefetched content
export const cleanupPrefetchedContent = async (
  userId: number
): Promise<void> => {
  try {
    const state = await getPrefetchState(userId);
    if (!state) return;

    const threshold = Date.now() - PREFETCH_TTL * 1000;
    if (state.lastPrefetchTime < threshold) {
      await redisService.del(`${PREFETCH_KEY_PREFIX}${userId}`);
    }
  } catch (error) {
    console.error("Error cleaning up prefetched content:", error);
    throw new APIErrorResponse(500, "Failed to cleanup prefetched content");
  }
};

// services/kafka/consumer.service.ts

import { Consumer } from "kafkajs";
import { kafka, KAFKA_TOPICS } from "../config/kafka.config";
import { KafkaEvent, EventType } from "../types/kafka.types";
import * as feedService from "./feed.service";
import * as redisService from "./redis.service";
import APIErrorResponse from "../lib/APIErrorResponse";

let consumer: Consumer;

export const initialize = async (groupId: string) => {
  try {
    consumer = kafka.consumer({ groupId });
    await consumer.connect();
    await consumer.subscribe({ topics: KAFKA_TOPICS });
    console.log("✅ Kafka Consumer connected successfully");
  } catch (error) {
    console.error("❌ Consumer connection failed:", error);
    throw new APIErrorResponse(500, "Failed to initialize Kafka consumer");
  }
};

export const startConsumer = async () => {
  try {
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const event: KafkaEvent = JSON.parse(message.value?.toString() || "");
        await handleEvent(event);
      },
    });
  } catch (error) {
    console.error("❌ Consumer processing failed:", error);
    throw new APIErrorResponse(500, "Failed to process Kafka messages");
  }
};

const handleEvent = async (event: KafkaEvent) => {
  console.log(`Processing event: ${event.type} (${event.id})`);

  switch (event.type) {
    case EventType.POST_CREATED:
      await handlePostCreated(event);
      break;

    case EventType.POST_UPDATED:
      await handlePostUpdated(event);
      break;

    case EventType.USER_FOLLOWED:
      await handleUserFollowed(event);
      break;

    case EventType.USER_UNFOLLOWED:
      await handleUserUnfollowed(event);
      break;

    case EventType.FANOUT_REGULAR:
      await handleRegularFanout(event);
      break;

    case EventType.FANOUT_POPULAR:
      await handlePopularFanout(event);
      break;

    case EventType.POST_POPULAR:
      await handlePopularPost(event);
      break;

    default:
      console.warn(`Unhandled event type: ${event.type}`);
  }
};

const handlePostCreated = async (event: KafkaEvent) => {
  const { userId, specializationId } = event.data;

  try {
    // Get affected users (followers + users with same specialization)
    const affectedUsers = await feedService.getAffectedUsers(
      userId,
      specializationId
    );

    // Update feeds and invalidate cache
    await Promise.all([
      feedService.addPostToFeeds(event.data, affectedUsers),
      redisService.invalidateFeeds(affectedUsers),
    ]);
  } catch (error) {
    console.error("Failed to handle post created event:", error);
  }
};

const handlePostUpdated = async (event: KafkaEvent) => {
  const { postId, userId, specializationId } = event.data;

  try {
    // Get affected users
    const affectedUsers = await feedService.getAffectedUsers(
      userId,
      specializationId
    );

    // Invalidate caches
    await Promise.all([
      redisService.invalidatePost(postId),
      redisService.invalidateFeeds(affectedUsers),
    ]);
  } catch (error) {
    console.error("Failed to handle post updated event:", error);
  }
};

const handleUserFollowed = async (event: KafkaEvent) => {
  const { followerId, followingId } = event.data;

  try {
    // Update follower's feed with following user's recent posts
    await feedService.updateFeedForNewFollow(followerId, followingId);

    // Invalidate follower's feed cache
    await redisService.invalidateFeed(followerId);
  } catch (error) {
    console.error("Failed to handle user followed event:", error);
  }
};

const handleUserUnfollowed = async (event: KafkaEvent) => {
  const { followerId } = event.data;

  try {
    // Simply invalidate follower's feed cache
    await redisService.invalidateFeed(followerId);
  } catch (error) {
    console.error("Failed to handle user unfollowed event:", error);
  }
};

const handleRegularFanout = async (event: KafkaEvent) => {
  const { postId, followers } = event.data;

  try {
    // Get post data from cache or database
    const post = await redisService.getPost(postId);
    if (!post) {
      throw new APIErrorResponse(404, "Post not found");
    }

    // Add post to each follower's feed cache
    await Promise.all(
      followers.map(async (followerId: number) => {
        const feed = await redisService.getFeedWithMetadata(followerId);
        if (feed.posts.length > 0) {
          const updatedFeed = [post, ...feed.posts.slice(0, -1)];
          await redisService.cacheFeedWithMetadata(followerId, updatedFeed);
        }
      })
    );
  } catch (error) {
    console.error("Failed to handle regular fan-out:", error);
  }
};

const handlePopularFanout = async (event: KafkaEvent) => {
  const { postId } = event.data;

  try {
    // For popular posts, we just add to popular posts list
    // Followers will get this when they load their feed
    const post = await redisService.getPost(postId);
    if (!post) {
      throw new APIErrorResponse(404, "Post not found");
    }

    await redisService.addPopularPost(postId, post.followerCount || 0);
  } catch (error) {
    console.error("Failed to handle popular fan-out:", error);
  }
};

const handlePopularPost = async (event: KafkaEvent) => {
  const { postId, followerCount } = event.data;

  try {
    // Add to popular posts list with score based on follower count
    await redisService.addPopularPost(postId, followerCount);
  } catch (error) {
    console.error("Failed to handle popular post:", error);
  }
};

export const shutdown = async () => {
  try {
    await consumer.disconnect();
  } catch (error) {
    console.error("❌ Consumer disconnection failed:", error);
  }
};

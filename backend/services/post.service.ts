// services/post.service.ts

import { db } from "../db/db";
import {
  posts,
  users,
  specializations,
  postMedia,
  follows,
} from "../models/schema";
import APIErrorResponse from "../lib/APIErrorResponse";
import { eq, desc, sql } from "drizzle-orm";
import { uploadToCloudinary } from "../utils/cloudinary";
import * as redisService from "./redis.service";
import * as producerService from "./event.producer";
import { POPULAR_USER_THRESHOLD } from "../types/kafka.types";

// Enhanced create post
export const createPost = async ({
  userId,
  title,
  content,
  specializationId,
  files,
}: {
  userId: number;
  title: string;
  content: string;
  specializationId: number;
  files?: Express.Multer.File[];
}) => {
  try {
    // Begin transaction
    const newPost = await db.transaction(async (tx) => {
      // Create post
      const [post] = await tx
        .insert(posts)
        .values({
          userId,
          title,
          content,
          specializationId,
        })
        .returning();

      // Handle media uploads if any
      if (files && files.length > 0) {
        for (const file of files) {
          const cloudinaryResponse = await uploadToCloudinary(file.path);
          if (cloudinaryResponse) {
            await tx.insert(postMedia).values({
              postId: post.id,
              url: cloudinaryResponse.secure_url,
              cloudinaryId: cloudinaryResponse.public_id,
              type: "image",
            });
          }
        }
      }

      return post;
    });

    // Get follower count and check if popular user
    const followerCount = await getFollowerCount(userId);
    const isPopular = followerCount >= POPULAR_USER_THRESHOLD;

    // Cache post
    await redisService.cachePost(newPost.id, {
      ...newPost,
      followerCount,
      isPopular,
    });

    // Emit appropriate events based on popularity
    if (isPopular) {
      await handlePopularUserPost(newPost, userId, followerCount);
    } else {
      await handleRegularUserPost(newPost, userId, followerCount);
    }

    return newPost;
  } catch (error) {
    console.error("Failed to create post:", error);
    throw new APIErrorResponse(500, "Failed to create post");
  }
};

const getFollowerCount = async (userId: number): Promise<number> => {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followingId, userId));

    return result[0].count;
  } catch (error) {
    console.error("Failed to get follower count:", error);
    throw new APIErrorResponse(500, "Failed to get follower count");
  }
};

const handlePopularUserPost = async (
  post: any,
  userId: number,
  followerCount: number
) => {
  // Add to popular posts in Redis with score based on follower count
  await redisService.addPopularPost(post.id, followerCount);

  // Emit popular post event
  await producerService.postCreated({
    postId: post.id,
    userId,
    title: post.title,
    content: post.content,
    specializationId: post.specializationId,
    followerCount,
    isPopular: true,
  });
};

const handleRegularUserPost = async (
  post: any,
  userId: number,
  followerCount: number
) => {
  // Get followers for immediate fan-out
  const followers = await getFollowers(userId);

  // Emit regular post event with followers
  await producerService.postCreated({
    postId: post.id,
    userId,
    title: post.title,
    content: post.content,
    specializationId: post.specializationId,
    followerCount,
    isPopular: false,
  });

  // Emit fan-out event
  await producerService.fanoutPost({
    postId: post.id,
    userId,
    followers: followers.map((f) => f.followerId),
    isPopular: false,
  });
};

const getFollowers = async (userId: number) => {
  try {
    return await db
      .select({
        followerId: follows.followerId,
      })
      .from(follows)
      .where(eq(follows.followingId, userId));
  } catch (error) {
    console.error("Failed to get followers:", error);
    throw new APIErrorResponse(500, "Failed to get followers");
  }
};

// Get post by ID with all relations
export const getPostById = async (postId: number) => {
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
    with: {
      author: true,
      media: true,
      specialization: true,
    },
  });

  if (!post) {
    throw new APIErrorResponse(404, "Post not found");
  }

  return post;
};

// Get user's posts
export const getUserPosts = async (userId: number, page = 1, limit = 10) => {
  const offset = (page - 1) * limit;

  const userPosts = await db.query.posts.findMany({
    where: eq(posts.userId, userId),
    with: {
      media: true,
      specialization: true,
    },
    limit,
    offset,
    orderBy: desc(posts.createdAt),
  });

  return userPosts;
};

// Update post
export const updatePost = async (
  postId: number,
  userId: number,
  {
    title,
    content,
    specializationId,
  }: {
    title?: string;
    content?: string;
    specializationId?: number;
  }
) => {
  // Check post ownership
  const post = await getPostById(postId);
  if (post.userId !== userId) {
    throw new APIErrorResponse(403, "Not authorized to update this post");
  }

  const [updatedPost] = await db
    .update(posts)
    .set({
      title: title ?? post.title,
      content: content ?? post.content,
      specializationId: specializationId ?? post.specializationId,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, postId))
    .returning();

  return updatedPost;
};

// Delete post
export const deletePost = async (postId: number, userId: number) => {
  // Check post ownership
  const post = await getPostById(postId);
  if (post.userId !== userId) {
    throw new APIErrorResponse(403, "Not authorized to delete this post");
  }

  await db.delete(posts).where(eq(posts.id, postId));
  return true;
};

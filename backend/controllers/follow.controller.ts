// controllers/follow.controller.ts
import { Request, Response } from "express";
import asyncHandler from "../utils/asynHandler";
import * as producerService from "../services/event.producer";
import APISuccessResponse from "../lib/APISuccessResponse";
import { db } from "../db/db";
import { follows, users } from "../models/schema";
import { eq, desc, exists, and, sql } from "drizzle-orm";

export const followUser = asyncHandler(async (req: Request, res: Response) => {
  const followerId = req.user.id;
  const followingId = Number(req.params.userId);

  // Prevent self-following
  if (followerId === followingId) {
    return res.status(400).json({
      status: "error",
      message: "You cannot follow yourself",
    });
  }

  // Create follow relationship in DB
  const [follow] = await db
    .insert(follows)
    .values({ followerId, followingId })
    .returning();

  // Emit Kafka event
  await producerService.userFollowed({
    followerId,
    followingId,
  });

  return res
    .status(200)
    .json(new APISuccessResponse(200, follow, "Successfully followed user"));
});

export const unfollowUser = asyncHandler(
  async (req: Request, res: Response) => {
    const followerId = req.user.id;
    const followingId = Number(req.params.userId);

    // Prevent self-unfollowing
    if (followerId === followingId) {
      return res.status(400).json({
        status: "error",
        message: "You cannot unfollow yourself",
      });
    }

    // Remove follow relationship
    await db
      .delete(follows)
      .where(
        and(
          eq(follows.followerId, followerId),
          eq(follows.followingId, followingId)
        )
      );

    // Emit Kafka event
    await producerService.userUnfollowed({
      followerId,
      followingId,
    });

    return res
      .status(200)
      .json(new APISuccessResponse(200, null, "Successfully unfollowed user"));
  }
);

export const getFollowers = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;

    // Get followers with isFollowing flag
    const followers = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImage: users.profileImage,
        createdAt: follows.createdAt,
        isOnboarded: users.isOnboarded,
        isFollowing: exists(
          db
            .select()
            .from(follows)
            .where(
              and(
                eq(follows.followerId, userId),
                eq(follows.followingId, users.id)
              )
            )
        ),
      })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(eq(follows.followingId, userId))
      .orderBy(desc(follows.createdAt));

    return res
      .status(200)
      .json(
        new APISuccessResponse(
          200,
          followers,
          "Successfully retrieved followers"
        )
      );
  }
);

export const getFollowing = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;

    // For following list, isFollowing is always true since these are the users we follow
    const following = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImage: users.profileImage,
        createdAt: follows.createdAt,
        isOnboarded: users.isOnboarded,
        isFollowing: sql`true`,
      })
      .from(follows)
      .innerJoin(users, eq(follows.followingId, users.id))
      .where(eq(follows.followerId, userId))
      .orderBy(desc(follows.createdAt));

    return res
      .status(200)
      .json(
        new APISuccessResponse(
          200,
          following,
          "Successfully retrieved following users"
        )
      );
  }
);

export const getFollowCounts = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = Number(req.params.userId);

    // Get follower and following counts
    const followerCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followingId, userId))
      .then((result) => result[0].count);

    const followingCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followerId, userId))
      .then((result) => result[0].count);

    return res
      .status(200)
      .json(
        new APISuccessResponse(
          200,
          { followerCount, followingCount },
          "Successfully retrieved follow counts"
        )
      );
  }
);

export const getFollowStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const followerId = req.user.id;
    const followingId = Number(req.params.userId);

    const [followStatus] = await db
      .select()
      .from(follows)
      .where(
        and(
          eq(follows.followerId, followerId),
          eq(follows.followingId, followingId)
        )
      );

    return res
      .status(200)
      .json(
        new APISuccessResponse(
          200,
          { isFollowing: !!followStatus },
          "Successfully retrieved follow status"
        )
      );
  }
);

export const getUserProfileWithFollowStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const currentUserId = req.user.id;
    const targetUserId = Number(req.params.userId);

    const userProfile = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImage: users.profileImage,
        isOnboarded: users.isOnboarded,
        isFollowing: exists(
          db
            .select()
            .from(follows)
            .where(
              and(
                eq(follows.followerId, currentUserId),
                eq(follows.followingId, users.id)
              )
            )
        ),
        followerCount: sql<number>`(
        SELECT COUNT(*) 
        FROM ${follows} 
        WHERE ${follows.followingId} = ${users.id}
      )`,
        followingCount: sql<number>`(
        SELECT COUNT(*) 
        FROM ${follows} 
        WHERE ${follows.followerId} = ${users.id}
      )`,
      })
      .from(users)
      .where(eq(users.id, targetUserId))
      .then((results) => results[0]);

    if (!userProfile) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    return res
      .status(200)
      .json(
        new APISuccessResponse(
          200,
          userProfile,
          "Successfully retrieved user profile"
        )
      );
  }
);

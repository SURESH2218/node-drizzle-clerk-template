// types/kafka.types.ts

export enum EventType {
  POST_CREATED = "post.created",
  POST_UPDATED = "post.updated",
  POST_DELETED = "post.deleted",
  POST_LIKED = "post.liked",
  USER_FOLLOWED = "user.followed",
  USER_UNFOLLOWED = "user.unfollowed",
  COMMENT_ADDED = "comment.added",
  FEED_UPDATED = "feed.updated",
  FEED_INVALIDATED = "feed.invalidated",
  POST_POPULAR = "post.popular",
  FANOUT_REGULAR = "fanout.regular",
  FANOUT_POPULAR = "fanout.popular",
}

export interface KafkaEvent {
  id: string;
  type: EventType;
  data: any;
  timestamp: number;
}

export interface PostEventData {
  postId: number;
  userId: number;
  title: string;
  content: string;
  specializationId: number;
  media?: string[];
  followerCount?: number;
  isPopular?: boolean;
}

export interface FollowEventData {
  followerId: number;
  followingId: number;
}

export interface InteractionEventData {
  postId: number;
  userId: number;
  type: "like" | "comment";
  data?: any;
}

export interface FeedEventData {
  userId: number;
  feedType: "following" | "specialization" | "trending";
  specializationId?: number;
}

export interface FanoutEventData {
  postId: number;
  userId: number;
  followers: number[];
  isPopular: boolean;
}

// Constants for fan-out strategy
export const POPULAR_USER_THRESHOLD = 1000; // Users with more than 1000 followers are considered popular
export const FEED_CACHE_EXPIRY = 300; // 5 minutes in seconds
export const POPULAR_POSTS_LIMIT = 100; // Maximum number of popular posts to keep
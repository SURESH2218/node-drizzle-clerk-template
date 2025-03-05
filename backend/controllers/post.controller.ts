import { Request, Response } from "express";
import * as postService from "../services/post.service";
import * as producerService from "../services/event.producer";
import * as aiService from "../services/ai.service";
import asyncHandler from "../utils/asynHandler";
import APISuccessResponse from "../lib/APISuccessResponse";

export const createPost = asyncHandler(async (req: Request, res: Response) => {
  const { title, content } = req.body;
  const userId = req.user.id;
  const files = req.files as Express.Multer.File[];

  // Use AI to categorize post
  const specializationId = await aiService.categorizePost(title, content);

  const newPost = await postService.createPost({
    userId,
    title,
    content,
    specializationId,
    files,
  });

  const postWithMedia = await postService.getPostById(newPost.id);

  await producerService.postCreated({
    postId: newPost.id,
    userId,
    title,
    content,
    specializationId: postWithMedia.specializationId!,
    media: postWithMedia.media?.map((m) => m.url),
  });

  return res
    .status(201)
    .json(new APISuccessResponse(201, newPost, "Post created successfully"));
});

export const getPost = asyncHandler(async (req: Request, res: Response) => {
  const { postId } = req.params;
  const post = await postService.getPostById(Number(postId));

  return res
    .status(200)
    .json(new APISuccessResponse(200, post, "Post retrieved successfully"));
});

export const getUserPosts = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const posts = await postService.getUserPosts(
      userId,
      Number(page),
      Number(limit)
    );

    return res
      .status(200)
      .json(new APISuccessResponse(200, posts, "Posts retrieved successfully"));
  }
);

export const updatePost = asyncHandler(async (req: Request, res: Response) => {
  const { postId } = req.params;
  const userId = req.user.id;
  const { title, content } = req.body;

  // If content changed, recategorize
  let specializationId;
  if (content) {
    specializationId = await aiService.categorizePost(title || "", content);
  }

  const updatedPost = await postService.updatePost(Number(postId), userId, {
    title,
    content,
    specializationId,
  });

  await producerService.postUpdated({
    postId: updatedPost.id,
    userId,
    title: updatedPost.title,
    content: updatedPost.content,
    specializationId: updatedPost.specializationId!,
  });

  return res
    .status(200)
    .json(
      new APISuccessResponse(200, updatedPost, "Post updated successfully")
    );
});

export const deletePost = asyncHandler(async (req: Request, res: Response) => {
  const { postId } = req.params;
  const userId = req.user.id;

  await postService.deletePost(Number(postId), userId);

  return res
    .status(200)
    .json(new APISuccessResponse(200, null, "Post deleted successfully"));
});

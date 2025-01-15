import { Request, Response } from "express";
import { db } from "../db/db";
import { users } from "../models/schema";
import asyncHandler from "../utils/asynHandler";
import APISuccessResponse from "../lib/APISuccessResponse";
import APIErrorResponse from "../lib/APIErrorResponse";

export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  try {
    const usersList = await db.select().from(users);
    return res
      .status(200)
      .json(
        new APISuccessResponse(200, usersList, "Users retrieved successfully")
      );
  } catch (error) {
    throw new APIErrorResponse(500, "Failed to retrieve users");
  }
});

// getAllUsers();

export const getCurrentUser = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      return res
        .status(200)
        .json(
          new APISuccessResponse(
            200,
            { user: req.user },
            "User retrieved successfully"
          )
        );
    } catch (error) {
      throw new APIErrorResponse(500, "Failed to get user");
    }
  }
);

// middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import { db } from "../db/db";
import { users } from "../models/schema";
import { eq } from "drizzle-orm";
import APIErrorResponse from "../lib/APIErrorResponse";

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const verifyAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const clerkId = req.headers["x-clerk-user-id"];

    if (!clerkId) {
      throw new APIErrorResponse(401, "Unauthorized - No Clerk ID provided");
    }

    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId as string),
    });

    if (!user) {
      throw new APIErrorResponse(401, "Unauthorized - User not found");
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

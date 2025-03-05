// middlewares/specialization.middleware.ts

import { Request, Response, NextFunction } from "express";
import { db } from "../db/db";
import { users } from "../models/schema";
import { eq } from "drizzle-orm";
import APIErrorResponse from "../lib/APIErrorResponse";

export const validateSpecializationSelection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { specializationIds } = req.body;

    // Check if specializationIds is provided and is an array
    if (!Array.isArray(specializationIds)) {
      throw new APIErrorResponse(
        400,
        "Specialization IDs must be provided as an array"
      );
    }

    // Check minimum and maximum limits
    if (specializationIds.length === 0) {
      throw new APIErrorResponse(
        400,
        "At least one specialization must be selected"
      );
    }

    if (specializationIds.length > 5) {
      throw new APIErrorResponse(400, "Maximum 5 specializations allowed");
    }

    // Check for duplicate IDs
    const uniqueIds = new Set(specializationIds);
    if (uniqueIds.size !== specializationIds.length) {
      throw new APIErrorResponse(
        400,
        "Duplicate specializations are not allowed"
      );
    }

    // Check if all IDs are numbers
    if (!specializationIds.every((id) => typeof id === "number")) {
      throw new APIErrorResponse(400, "Invalid specialization ID format");
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const checkOnboardingStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user.id),
    });

    if (!user) {
      throw new APIErrorResponse(404, "User not found");
    }

    // For onboarding-required routes
    if (req.path.includes("/onboarding") && user.isOnboarded) {
      throw new APIErrorResponse(400, "User is already onboarded");
    }

    // For routes that require completed onboarding
    if (!req.path.includes("/onboarding") && !user.isOnboarded) {
      throw new APIErrorResponse(403, "Please complete onboarding first");
    }

    next();
  } catch (error) {
    next(error);
  }
};

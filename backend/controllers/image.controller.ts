import { db } from "../db/db";
import { eq, desc } from "drizzle-orm";
import { images, users } from "../models/schema";
import { Request, Response } from "express";
import asyncHandler from "../utils/asynHandler";
import { uploadToCloudinary } from "../utils/cloudinary";
import APIErrorResponse from "../lib/APIErrorResponse";
import APISuccessResponse from "../lib/APISuccessResponse";

export const uploadImages = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      const userId = req.user?.clerkId;

      if (!files || files.length === 0) {
        throw new APIErrorResponse(400, "No files uploaded");
      }

      if (files.length > 5) {
        throw new APIErrorResponse(400, "Maximum 5 images allowed");
      }

      const uploadPromises = files.map(async (file) => {
        const cloudinaryResponse = await uploadToCloudinary(file.path);

        if (!cloudinaryResponse) {
          throw new APIErrorResponse(
            500,
            "Failed to upload image to Cloudinary"
          );
        }

        return db.insert(images).values({
          url: cloudinaryResponse.secure_url,
          cloudinaryId: cloudinaryResponse.public_id,
          userId: userId,
        });
      });

      await Promise.all(uploadPromises);

      // Fetch newly uploaded images with user data
      const userImages = await db.query.images.findMany({
        where: eq(images.userId, userId),
        with: {
          user: {
            columns: {
              firstName: true,
              lastName: true,
              profileImage: true,
            },
          },
        },
        orderBy: [desc(images.createdAt)],
      });

      return res
        .status(200)
        .json(
          new APISuccessResponse(
            200,
            userImages,
            "Images uploaded successfully"
          )
        );
    } catch (error: any) {
      throw new APIErrorResponse(
        error.statusCode || 500,
        error.message || "Failed to upload images"
      );
    }
  }
);

export const getAllImages = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const allImages = await db.query.images.findMany({
        with: {
          user: {
            columns: {
              firstName: true,
              lastName: true,
              profileImage: true,
            },
          },
        },
        orderBy: [desc(images.createdAt)],
      });

      if (!allImages.length) {
        return res
          .status(200)
          .json(new APISuccessResponse(200, [], "No images found"));
      }

      return res
        .status(200)
        .json(
          new APISuccessResponse(
            200,
            allImages,
            "Images retrieved successfully"
          )
        );
    } catch (error: any) {
      throw new APIErrorResponse(
        error.statusCode || 500,
        error.message || "Failed to retrieve images"
      );
    }
  }
);

export const getUserImages = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      //   const userId = req.user?.clerkId;

      const userImages = await db.select().from(images);
      if (userImages.length === 0) {
        throw new APIErrorResponse(404, "No images found");
      }
      // .where(eq(images.userId, userId))
      // .orderBy(desc(images.createdAt));

      return res
        .status(200)
        .json(
          new APISuccessResponse(
            200,
            userImages,
            "Images retrieved successfully"
          )
        );
    } catch (error: any) {
      throw new APIErrorResponse(
        error.statusCode || 500,
        error.message || "Failed to retrieve images"
      );
    }
  }
);

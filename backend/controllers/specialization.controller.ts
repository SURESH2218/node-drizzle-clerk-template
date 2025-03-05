// controllers/specialization.controller.ts

import { Request, Response } from "express";
import * as specializationService from "../services/specialization.service";
import asyncHandler from "../utils/asynHandler";
import APISuccessResponse from "../lib/APISuccessResponse";
import APIErrorResponse from "../lib/APIErrorResponse";

export const getAllSpecializations = asyncHandler(
  async (req: Request, res: Response) => {
    const specializations = await specializationService.getAllSpecializations();
    return res
      .status(200)
      .json(
        new APISuccessResponse(
          200,
          specializations,
          "Specializations retrieved successfully"
        )
      );
  }
);

export const getUserSpecializations = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const specializations = await specializationService.getUserSpecializations(
      userId
    );
    return res
      .status(200)
      .json(
        new APISuccessResponse(
          200,
          specializations,
          "User specializations retrieved successfully"
        )
      );
  }
);

export const setUserSpecializations = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { specializationIds } = req.body;

    if (!Array.isArray(specializationIds) || specializationIds.length === 0) {
      throw new APIErrorResponse(
        400,
        "Please provide valid specialization IDs"
      );
    }

    if (specializationIds.length > 5) {
      throw new APIErrorResponse(400, "Maximum 5 specializations allowed");
    }

    const updatedSpecializations =
      await specializationService.setUserSpecializations(
        userId,
        specializationIds
      );

    return res
      .status(200)
      .json(
        new APISuccessResponse(
          200,
          updatedSpecializations,
          "User specializations updated successfully"
        )
      );
  }
);

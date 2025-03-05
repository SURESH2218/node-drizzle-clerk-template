import { Request, Response } from "express";
import asyncHandler from "../utils/asynHandler";
import APISuccessResponse from "../lib/APISuccessResponse";
import { checkSystemHealth } from "../services/monitoring.service";

export const getHealthStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const healthStatus = await checkSystemHealth();

    return res.status(healthStatus.healthy ? 200 : 503).json(
      new APISuccessResponse(healthStatus.healthy ? 200 : 503, {
        status: healthStatus.healthy ? "healthy" : "unhealthy",
        metrics: healthStatus.metrics,
      })
    );
  }
);

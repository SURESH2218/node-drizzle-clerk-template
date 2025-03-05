// routes/specialization.routes.ts

import express from "express";
import { verifyAuth } from "../middlewares/auth.middleware";
import {
  validateSpecializationSelection,
  checkOnboardingStatus,
} from "../middlewares/specialization.middleware";
import {
  getAllSpecializations,
  getUserSpecializations,
  setUserSpecializations,
} from "../controllers/specialization.controller";

const router = express.Router();

// Public route - available without onboarding
router.get("/", verifyAuth, getAllSpecializations);

// User must complete onboarding to access these routes
router.get("/user", verifyAuth, checkOnboardingStatus, getUserSpecializations);

// Onboarding route
router.post(
  "/user/onboarding",
  verifyAuth,
  validateSpecializationSelection,
  setUserSpecializations
);

// Update specializations after onboarding
router.put(
  "/user",
  verifyAuth,
  checkOnboardingStatus,
  validateSpecializationSelection,
  setUserSpecializations
);

export default router;

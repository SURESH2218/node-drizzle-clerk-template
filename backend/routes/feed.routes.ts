import express from "express";
import { verifyAuth } from "../middlewares/auth.middleware";
import {
  getFeed,
  getPollingInterval,
  getDifferentialUpdates,
} from "../controllers/feed.controller";

const router = express.Router();

router.use(verifyAuth);
router.get("/", getFeed);
router.get("/polling-interval", getPollingInterval);
router.get("/updates", getDifferentialUpdates);

export default router;
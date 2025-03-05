import express from "express";
import { verifyAuth } from "../middlewares/auth.middleware";
import {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getFollowCounts,
  getFollowStatus,
  getUserProfileWithFollowStatus,
} from "../controllers/follow.controller";

const router = express.Router();

router.use(verifyAuth);
router.post("/:userId/follow", followUser);
router.post("/:userId/unfollow", unfollowUser);
router.get("/followers", getFollowers);
router.get("/following", getFollowing);
router.get("/:userId/counts", getFollowCounts);
router.get("/:userId/status", getFollowStatus);
router.get("/:userId/profile", getUserProfileWithFollowStatus);

export default router;

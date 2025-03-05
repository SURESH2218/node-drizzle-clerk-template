import express from "express";
import { verifyAuth } from "../middlewares/auth.middleware";
import { checkOnboardingStatus } from "../middlewares/specialization.middleware";
import { upload } from "../middlewares/multer.middleware";
import {
  createPost,
  getPost,
  getUserPosts,
  updatePost,
  deletePost,
} from "../controllers/post.controller";

const router = express.Router();

// All routes require auth and completed onboarding
router.use(verifyAuth, checkOnboardingStatus);

router.post("/create-post", upload.array("media", 5), createPost);
router.get("/user", getUserPosts);
router.get("/:postId", getPost);
router.put("/:postId", updatePost);
router.delete("/:postId", deletePost);

export default router;
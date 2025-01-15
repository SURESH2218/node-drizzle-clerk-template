import express from "express";
import { upload } from "../middlewares/multer.middleware";
import {
  uploadImages,
  getUserImages,
  getAllImages,
} from "../controllers/image.controller";
import { verifyAuth } from "../middlewares/auth.middleware";

const router = express.Router();

router
  .route("/upload-images")
  .post(verifyAuth, upload.array("images", 5), uploadImages);
router.route("/all-images").get(getAllImages);
// router.route("/all-images").get(getUserImages);

export default router;

import express from "express";
import { getAllUsers, getCurrentUser } from "../controllers/user.controller";
import { verifyAuth } from "../middlewares/auth.middleware";

const router = express.Router();

router.get("/all-users", verifyAuth, getAllUsers);
router.get("/current-user", verifyAuth, getCurrentUser);

export default router;

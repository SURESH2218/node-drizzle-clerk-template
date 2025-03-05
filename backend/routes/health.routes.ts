import express from "express";
import { getHealthStatus } from "../controllers/health.controller";

const router = express.Router();

router.get("/", getHealthStatus);

export default router;

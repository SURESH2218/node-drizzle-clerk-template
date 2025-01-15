import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { handleErrors, notFound } from "./middlewares/errorHandler";
import { handleClerkWebhook } from "./controllers/webhook.controller";

const app = express();

app.post(
  "/api/webhooks/clerk",
  express.raw({ type: "application/json" }),
  handleClerkWebhook
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(cookieParser());

// Routes
import authRoutes from "./routes/auth.routes";
import imageRoutes from "./routes/image.routes";

app.use("/api", authRoutes);
app.use("/image", imageRoutes);

app.get("/", (req: Request, res: Response): void => {
  res.status(200).json({
    message: "Welcome to drugboard.ai API...",
  });
});

app.use(notFound);
app.use(handleErrors);

export default app;

import Redis from "ioredis";
import APIErrorResponse from "../lib/APIErrorResponse";

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
});

redis.on("error", (error) => {
  console.error("Redis Error:", error);
  throw new APIErrorResponse(500, "Redis connection failed");
});

redis.on("connect", () => {
  console.log("✅ Redis connected successfully");
});

export default redis;
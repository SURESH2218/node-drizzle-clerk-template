import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../models/schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

export const connectDB = async () => {
  try {
    if (pool.connected) {
      console.log("👍 Database already connected");
      return db;
    }

    await pool.connect();
    console.log("👍 Database connected successfully");
    return db;
  } catch (error: any) {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  }
};

export default db;

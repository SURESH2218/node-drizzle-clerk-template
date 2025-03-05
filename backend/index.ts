import "dotenv/config";
// server.ts or index.ts
import app, { initializeServices } from "./app";
import { connectDB } from "./db/db";

const startServer = async () => {
  try {
    // Connect to database first
    await connectDB();

    const PORT = process.env.PORT || 8000;
    initializeServices();
    app.listen(PORT, () => {
      console.log(`⚙️  Server is running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

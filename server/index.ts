import express from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { createServer } from "http";
import cors from "cors";
import { env } from "./lib/env";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function log(message: string) {
  console.log(`[express] ${message}`);
}

const app = express();

// Basic CORS setup
app.use(cors({
  origin: true,
  credentials: true
}));

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Register routes
registerRoutes(app);

(async () => {
  try {
    const server = createServer(app);
    
    // Configure environment-specific settings
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Start the server
    const PORT = parseInt(process.env.PORT || '5000', 10);
    server.listen({
      port: PORT,
      host: '0.0.0.0'
    }, () => {
      log(`Server running on port ${PORT}`);
      log(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    log(`Fatal error during server startup: ${error}`);
    process.exit(1);
  }
})();
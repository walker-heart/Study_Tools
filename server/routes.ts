import type { Express } from "express";
import { registerRoutes as registerAPIRoutes } from "./routes/index";

export function registerRoutes(app: Express) {
  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Register all API routes
  registerAPIRoutes(app);
}

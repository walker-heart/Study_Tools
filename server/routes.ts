import { Router, type Express } from "express";
import { registerRoutes as registerAPIRoutes } from "./routes/index";

export function registerRoutes(app: Express) {
  // Create API router
  const apiRouter = Router();

  // Health check endpoint
  apiRouter.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Register all API routes
  registerAPIRoutes(apiRouter);
  
  // Mount all routes under /api prefix
  app.use('/api', apiRouter);
}

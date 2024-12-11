import type { Express } from "express";
import { registerRoutes as registerAPIRoutes } from "./routes/index";

export function registerRoutes(app: Express) {
  try {
    // Health check endpoint
    app.get('/api/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Register all API routes
    registerAPIRoutes(app);
    
    console.log('Routes registered successfully');
  } catch (error) {
    console.error('Error registering routes:', error);
    throw error; // Re-throw to be caught by the main error handler
  }
}

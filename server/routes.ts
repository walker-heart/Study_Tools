import type { Express } from "express";
import { registerRoutes as registerAPIRoutes } from "./routes/index";
import { log } from "./lib/logger";

export function registerRoutes(app: Express) {
  try {
    // Health check endpoint
    app.get('/api/health', (_req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        env: app.get('env')
      });
    });

    // Register all API routes
    log('Registering API routes...');
    registerAPIRoutes(app);
    log('API routes registered successfully');

  } catch (error) {
    log(`Error registering routes: ${error}`);
    throw error; // Re-throw to be handled by global error handler
  }
}

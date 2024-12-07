import type { Express } from "express";

export function registerRoutes(app: Express) {
  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // All other API routes should be prefixed with /api
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
    } else {
      next();
    }
  });
}

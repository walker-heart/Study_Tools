import { Router } from "express";

export function registerRoutes(): Router {
  const router = Router();

  // Health check endpoint
  router.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return router;
}

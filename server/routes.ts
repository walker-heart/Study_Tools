import express, { type Express, Router } from "express";
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

  // Handle 404 for API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({ 
      message: 'API endpoint not found',
      path: req.path
    });
  });

  // Debug endpoint to list all registered routes
  if (process.env.NODE_ENV !== 'production') {
    app.get('/debug/routes', (_req, res) => {
      const routes = apiRouter.stack
        .filter(r => r.route)
        .map(r => ({
          path: `/api${r.route?.path || ''}`,
          methods: Object.keys(r.route || {})
            .filter(key => typeof (r.route as any)[key] === 'function')
        }));
      res.json(routes);
    });
  }
}

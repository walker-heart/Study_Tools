import express, { type Express, Router } from "express";
import { registerRoutes as registerAPIRoutes } from "./routes/index";
import path from 'path';

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
  app.use('/api/*', (_req, res) => {
    res.status(404).json({ 
      message: 'API endpoint not found',
      timestamp: new Date().toISOString()
    });
  });

  // Handle client-side routing, but exclude /assets paths
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/assets/')) {
      next();
    } else {
      res.sendFile(path.join(__dirname, '..', 'dist', 'public', 'index.html'), (err) => {
        if (err) {
          console.error('Error sending index.html:', err);
          res.status(500).send('Error loading application');
        }
      });
    }
  });
}
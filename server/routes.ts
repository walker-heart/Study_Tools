import express, { type Express, Router } from "express";
import { registerRoutes as registerAPIRoutes } from "./routes/index";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // Handle 404 for API routes
  app.use('/api/*', (_req, res) => {
    res.status(404).json({ 
      message: 'API endpoint not found',
      requestId: _req.headers['x-request-id']
    });
  });

  // Log static file access attempts in development
  if (process.env.NODE_ENV !== 'production') {
    app.use((req, _res, next) => {
      console.log('Static file request:', {
        path: req.path,
        method: req.method,
        headers: req.headers
      });
      next();
    });
  }

  // Handle client-side routing for all non-API routes
  app.get('*', (req, res) => {
    // Skip if requesting a static asset
    if (req.path.startsWith('/assets/')) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }

    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    
    // Check if index.html exists
    if (!fs.existsSync(indexPath)) {
      console.error('index.html not found at:', indexPath);
      res.status(500).send('Application files not found');
      return;
    }

    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('Error sending index.html:', {
          error: err.message,
          path: indexPath,
          requestPath: req.path
        });
        res.status(500).send('Error loading application');
      }
    });
  });
}
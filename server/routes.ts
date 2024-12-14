import express, { Router, type Express } from "express";
import { registerRoutes as registerAPIRoutes } from "./routes/index";
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './lib/env';

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
      requestId: _req.headers['x-request-id']
    });
  });

  // Log requests in development
  if (env.NODE_ENV === 'development') {
    app.use((req, _res, next) => {
      console.log('Request:', {
        path: req.path,
        method: req.method,
        type: req.path.startsWith('/api') ? 'api' : 'static'
      });
      next();
    });
  }

  // Handle static files in production
  if (env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, '..', 'dist');
    console.log('Static files path:', distPath);
    
    // Add static file middleware with detailed error logging
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        console.log('Static file request:', {
          path: req.path,
          method: req.method,
          url: req.url
        });
      }
      next();
    });

    app.use(express.static(distPath, {
      maxAge: '1h',
      index: false,
      fallthrough: true
    }));
  }

  // Handle client-side routing
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ message: 'API endpoint not found' });
    }
    
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    console.log('Serving index.html for path:', req.path);
    
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('Error serving index.html:', {
          error: err.message,
          path: indexPath,
          requestPath: req.path
        });
        res.status(500).send('Error loading application');
      }
    });
  });
}
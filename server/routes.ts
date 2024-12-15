import { Router, Request, Response } from "express";
import { registerRoutes as registerAPIRoutes } from "./routes/index";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function registerRoutes(router: Router) {
  // Health check endpoint
  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Register all API routes under /api prefix
  const apiRouter = Router();
  registerAPIRoutes(apiRouter);
  router.use('/api', apiRouter);
}

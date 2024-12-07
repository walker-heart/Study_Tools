import { Router, type Request, type Response, type NextFunction, type RequestHandler } from "express";
import passport from "../auth/passport";

export function registerRoutes(): Router {
  const router = Router();

  // Wrap route handlers with proper error handling
  const asyncHandler = (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
  ): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };

  // User info route
  router.get('/api/auth/user', asyncHandler(async (req: Request, res: Response) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ message: 'Not authenticated' });
    }
  }));

  return router;
}

import { Router } from "express";
import passport from "../auth/passport";
import { type Request, type Response, type NextFunction } from "express";

export function registerRoutes(): Router {
  const router = Router();

  // Wrap route handlers with proper error handling
  const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
    return (req: Request, res: Response, next: NextFunction) => {
      return Promise.resolve(fn(req, res, next)).catch(next);
    };
  };

  // Google OAuth routes
  router.get('/api/auth/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );
  
  router.get('/api/auth/google/callback', 
    passport.authenticate('google', { 
      failureRedirect: '/login',
      successRedirect: '/'
    })
  );

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